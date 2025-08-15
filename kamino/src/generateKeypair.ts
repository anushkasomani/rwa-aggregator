import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function generateAdminKeypair() {
    try {
        const secretKey = process.env.SECRET_KEY;
        
        if (!secretKey) {
            console.error('SECRET_KEY not found in .env file');
            return;
        }

        console.log('🔄 Converting SECRET_KEY to admin.json format...');

        // Convert base58 secret key to keypair
        const keypair = Keypair.fromSecretKey(bs58.decode(secretKey));
        
        // Convert to array format for JSON file
        const keypairArray = Array.from(keypair.secretKey);
        
        // Save to admin.json file in the kamino directory
        const adminFilePath = path.join(__dirname, '..', 'admin.json');
        fs.writeFileSync(adminFilePath, JSON.stringify(keypairArray));
        
        console.log('✅ admin.json file created successfully!');
        console.log('📍 Location:', adminFilePath);
        console.log('🔑 Public Key:', keypair.publicKey.toString());
        console.log('💾 Keypair saved in JSON array format');
        
        // Verify the file was created
        if (fs.existsSync(adminFilePath)) {
            console.log('✅ File verification: admin.json exists and is ready to use');
        }
        
    } catch (error) {
        console.error('❌ Error generating keypair file:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message);
        }
    }
}

// Run the function
generateAdminKeypair();