/**
 * scripts/publish.js
 *
 * Combina en un solo paso:
 *   1. npm run build   -> genera dist/
 *   2. npm run deploy  -> publica dist/ en la rama gh-pages (GitHub Pages)
 *   3. git add + commit + push -> guarda el código fuente en la rama main
 *
 * Uso:
 *   npm run publish
 *   npm run publish -- "Mensaje de commit personalizado"
 */

const { execSync } = require('child_process');

function run(cmd) {
  console.log('\n> ' + cmd);
  execSync(cmd, { stdio: 'inherit' });
}

function runOptional(cmd, onFailMessage) {
  try {
    run(cmd);
    return true;
  } catch (e) {
    console.log('\n⚠️  ' + onFailMessage);
    return false;
  }
}

const commitMessage = process.argv[2] || 'Actualizacion del sitio';

try {
  console.log('=== 1/3: Compilando el proyecto (build) ===');
  run('npm run build');

  console.log('\n=== 2/3: Publicando el sitio en GitHub Pages (deploy) ===');
  run('npm run deploy');

  console.log('\n=== 3/3: Guardando el código en GitHub (git) ===');
  run('git add .');

  const committed = runOptional(
    'git commit -m "' + commitMessage.replace(/"/g, '\\"') + '"',
    'No había cambios de código nuevos para guardar (o el commit no aplicó). Continuando...'
  );

  if (committed) {
    run('git push');
  } else {
    // Aun sin commit nuevo, intenta push por si hay commits locales pendientes de subir.
    runOptional('git push', 'No había nada pendiente de subir a GitHub.');
  }

  console.log('\n✅ Publicación completa: sitio actualizado en GitHub Pages y código guardado en GitHub.');
} catch (err) {
  console.error('\n❌ Ocurrió un error durante la publicación. Revisa el mensaje de arriba.');
  process.exit(1);
}