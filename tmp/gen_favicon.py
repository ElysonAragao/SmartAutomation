import os

input_path = r'c:\Users\elyso\.gemini\antigravity\scratch\SmartAutomation\docs\firebase_source\extracted\src\app\favicon.ico'
output_path = r'c:\Users\elyso\.gemini\antigravity\scratch\SmartAutomation\firmware\SmartAutomation\Favicon.h'

if os.path.exists(input_path):
    with open(input_path, 'rb') as f:
        data = f.read()
    
    with open(output_path, 'w') as f:
        f.write('#ifndef FAVICON_H\n#define FAVICON_H\n\n#include <Arduino.h>\n\n')
        f.write('const uint8_t favicon_ico[] PROGMEM = {\n')
        hex_data = [hex(b) for b in data]
        for i in range(0, len(hex_data), 12):
            f.write('  ' + ', '.join(hex_data[i:i+12]) + ',\n')
        f.write('};\n\n')
        f.write(f'const size_t favicon_ico_len = {len(data)};\n\n#endif\n')
    print(f"Success: {output_path} generated.")
else:
    print(f"Error: {input_path} not found.")
