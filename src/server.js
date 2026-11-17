import express from 'express';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { typeDefs, resolvers } from './schema.js';
import { dbPath } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, '..', 'public');

const app = express();
const httpServer = createServer(app);

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
});

await server.start();

app.use('/graphql', express.json({ limit: '2mb' }), expressMiddleware(server));
app.use(express.static(publicDir));

const puerto = Number(process.env.PORT) || 4000;

await new Promise((resolveListen) => httpServer.listen({ port: puerto }, resolveListen));

console.log('API GraphQL del colegio lista');
console.log(`  Frontend : http://localhost:${puerto}/`);
console.log(`  GraphQL  : http://localhost:${puerto}/graphql`);
console.log(`  Base de datos SQLite: ${dbPath}`);
