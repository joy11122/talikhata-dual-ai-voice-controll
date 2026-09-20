import 'next-auth';
import 'next-auth/jwt';
declare module 'next-auth' { interface Session { user:{id:string;shopId?:string;role?:'USER'|'ADMIN';status?:'ACTIVE'|'SUSPENDED'}&DefaultSession['user'] } interface User {shopId?:string;role?:'USER'|'ADMIN';status?:'ACTIVE'|'SUSPENDED'} }
declare module 'next-auth/jwt' { interface JWT {id?:string;shopId?:string;role?:'USER'|'ADMIN';status?:'ACTIVE'|'SUSPENDED'} }
