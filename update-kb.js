import { execSync } from 'child_process';
import fs from 'fs';

console.log('🔄 Actualizando base de conocimiento...');

// Borrar embeddings antiguos
if (fs.existsSync('./embeddings.json')) {
  fs.unlinkSync('./embeddings.json');
  console.log('✅ embeddings.json borrado');
}

if (fs.existsSync('./embeddings_progress.json')) {
  fs.unlinkSync('./embeddings_progress.json');
  console.log('✅ embeddings_progress.json borrado');
}

console.log('🚀 Iniciando servidor para regenerar embeddings...');
execSync('npm start', { stdio: 'inherit' });