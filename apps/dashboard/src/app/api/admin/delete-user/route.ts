import { NextResponse } from 'next/server';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Inicialização segura do Firebase Admin
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

    // 1. Tentar apagar o usuário no Auth (por e-mail, precisamos pegar o UID primeiro)
    try {
      const userRecord = await auth.getUserByEmail(email);
      await auth.deleteUser(userRecord.uid);
      console.log(`Usuário do Auth apagado com sucesso: ${email}`);
    } catch (authError: any) {
      // Se não achar o usuário no Auth (auth/user-not-found), podemos continuar e apagar no Firestore
      if (authError.code !== 'auth/user-not-found') {
         throw authError;
      }
    }

    // 2. Apagar o documento no Firestore
    await db.collection('users').doc(email).delete();
    console.log(`Documento do Firestore apagado com sucesso: ${email}`);

    return NextResponse.json({ success: true, message: 'Cliente excluído com sucesso.' });
  } catch (error: any) {
    console.error('Erro geral ao excluir usuário:', error);
    return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
  }
}
