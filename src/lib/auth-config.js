// Staff login (Better Auth), shared by the site (src/lib/auth.js) and scripts/create-staff.mjs.
// Staff are invite-only: public sign-up is off, and accounts are created by the owner.
// Roles come from Better Auth's admin plugin: "admin" = owner, "user" = instructor.
import { mongodbAdapter } from '@better-auth/mongo-adapter'
import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'

export const ROLES = { owner: 'admin', instructor: 'user' }
export const roleLabel = (role) => (role === ROLES.owner ? 'Owner' : 'Instructor')
export const isOwner = (user) => user?.role === ROLES.owner

export function createAuth({ db, client, secret, baseURL }) {
  return betterAuth({
    appName: 'Firearms Academy Canada',
    secret,
    ...(baseURL ? { baseURL } : {}),
    database: mongodbAdapter(db, { client }),
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12 },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    plugins: [admin({ defaultRole: ROLES.instructor, adminRoles: [ROLES.owner] })],
  })
}
