import 'server-only';
import NextAuth from 'next-auth';
import authConfig from './auth.config';
import {authConfig as serverAuthConfig} from '@/lib/auth';
export const {handlers,auth,signIn,signOut}=NextAuth({...authConfig,...serverAuthConfig,pages:authConfig.pages});
