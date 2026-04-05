import NextAuth, { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { readLedger, writeLedger } from "@/lib/ledger";
import { createHash } from "crypto";

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  verified: boolean;
  createdAt: number;
}

async function getUsers(): Promise<StoredUser[]> {
  const ledger = await readLedger();
  return (ledger.users as StoredUser[]) ?? [];
}

async function saveUsers(users: StoredUser[]): Promise<void> {
  const ledger = await readLedger();
  ledger.users = users;
  await writeLedger(ledger);
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(password + (process.env.NEXTAUTH_SECRET ?? "")).digest("hex");
}

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<StoredUser> {
  const users = await getUsers();
  if (users.find((u) => u.email === email)) throw new Error("User already exists");
  const user: StoredUser = {
    id: createHash("sha256").update(email).digest("hex").slice(0, 16),
    name,
    email,
    passwordHash: hashPassword(password),
    verified: false,
    createdAt: Date.now(),
  };
  users.push(user);
  await saveUsers(users);
  return user;
}

export async function verifyAndActivateUser(email: string): Promise<void> {
  const users = await getUsers();
  const idx = users.findIndex((u) => u.email === email);
  if (idx !== -1) {
    users[idx].verified = true;
    await saveUsers(users);
  }
}

export async function findUser(email: string, password: string): Promise<StoredUser | null> {
  const users = await getUsers();
  return (
    users.find(
      (u) =>
        u.email === email &&
        u.passwordHash === hashPassword(password) &&
        u.verified
    ) ?? null
  );
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await findUser(credentials.email, credentials.password);
        if (!user) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/" },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const users = await getUsers();
        if (!users.find((u) => u.email === user.email)) {
          await saveUsers([
            ...users,
            {
              id: createHash("sha256").update(user.email).digest("hex").slice(0, 16),
              name: user.name ?? "Google User",
              email: user.email,
              passwordHash: "",
              verified: true,
              createdAt: Date.now(),
            },
          ]);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.userId as string;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };