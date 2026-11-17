/** Elimina el archivo SQLite para volver a cargar los datos de ejemplo. */
import { reiniciarBaseDeDatos, dbPath } from '../src/db.js';

reiniciarBaseDeDatos();
console.log(`Base de datos eliminada: ${dbPath}`);
console.log('Vuelve a ejecutar "npm start" para recrearla con los datos iniciales.');
