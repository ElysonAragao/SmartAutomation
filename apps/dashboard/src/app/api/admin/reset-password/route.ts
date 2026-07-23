import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length > 0) {
    return;
  }
  
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('A variável de ambiente FIREBASE_SERVICE_ACCOUNT não foi definida.');
  }

  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Erro ao inicializar Firebase Admin:', error);
    throw new Error('Certificado de serviço inválido.');
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: 'E-mail do usuário não fornecido.' }, { status: 400 });
    }

    try {
      initAdmin();
    } catch (e: any) {
       return NextResponse.json({ error: e.message }, { status: 500 });
    }

    const auth = getAuth();
    const db = getFirestore();

    // 1. Atualizar a senha no Auth para '123456'
    try {
      const userRecord = await auth.getUserByEmail(email);
      await auth.updateUser(userRecord.uid, {
        password: '123456'
      });
      console.log(`Senha resetada no Auth para: ${email}`);
    } catch (authError: any) {
      if (authError.code === 'auth/user-not-found') {
        return NextResponse.json({ error: 'Usuário não encontrado no sistema de autenticação.' }, { status: 404 });
      }
      throw authError;
    }

    // 2. Atualizar o Firestore para forçar a troca de senha no próximo login
    await db.collection('users').doc(email).update({
      mustChangePassword: true
    });
    console.log(`mustChangePassword definido como true para: ${email}`);

    return NextResponse.json({ success: true, message: 'Senha resetada com sucesso para 123456.' });
  } catch (error: any) {
    console.error('Erro geral ao resetar senha:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
