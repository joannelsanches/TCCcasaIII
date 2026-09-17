import mongoose from 'mongoose';

export async function conectarBanco() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('A variável MONGODB_URI não foi configurada.');
  await mongoose.connect(uri);
  console.log('MongoDB conectado.');
}

export default mongoose;
