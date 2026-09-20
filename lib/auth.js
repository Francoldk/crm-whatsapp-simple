import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://jcnsepbalxyscxrsyade.supabase.co',
  process.env.SUPABASE_KEY || 'TU_SUPABASE_KEY_ACA' // Reemplazá con tu key real
);

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Usuario', type: 'text' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Faltan credenciales');
        }

        const { data: user, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', credentials.email.toLowerCase().trim())
          .single();

        if (error || !user) throw new Error('Usuario no encontrado');

        const ok = await bcrypt.compare(credentials.password, user.password);
        if (!ok) throw new Error('Contraseña incorrecta');

        // Actualizar último login
        await supabase.from('users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET || 'dcam-secret-key-2026',
};