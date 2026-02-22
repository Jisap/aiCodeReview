import { PrismaClient } from "@prisma/client"; // Permite interactuar con la base de datos

const createPrismaClient = () => {
  return new PrismaClient()                                           // Crea una instancia de PrismaClient
};

const globalPrismaClient = globalThis as unknown as {                 // globalThis es un objeto global que permite acceder a variables globales
  prisma: ReturnType<typeof createPrismaClient> | undefined;          // se configura una prop en globalThis que es el prismaClient  
};

export const db = globalPrismaClient.prisma ?? createPrismaClient();  // si no existe el prismaClient se crea

if (process.env.NODE_ENV !== 'production') {                          // si no es produccion
  globalPrismaClient.prisma = db                                      // se asigna el prismaClient a globalThis
}