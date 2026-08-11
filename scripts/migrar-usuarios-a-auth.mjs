import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.resolve(__dirname, '..', '.env.local')

function loadEnv(file) {
  if (!existsSync(file)) return
  const content = readFileSync(file, 'utf-8')
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2]
  }
}

loadEnv(envFile)

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

const INVITE = process.argv.includes('--invite')

async function main() {
  const { data: usuarios, error } = await admin
    .from('usuarios')
    .select('id, email, nombre')
    .is('auth_id', null)

  if (error) {
    console.error('Error leyendo usuarios:', error.message)
    process.exit(1)
  }

  console.log(`Encontrados ${usuarios.length} usuarios sin auth_id`)

  for (const u of usuarios) {
    try {
      let authId
      if (INVITE) {
        const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(u.email, {
          data: { nombre: u.nombre },
        })
        if (inviteError) throw inviteError
        authId = data.user.id
      } else {
        const tempPassword = `${u.email.replace(/[^a-zA-Z0-9]/g, '')}${Date.now().toString().slice(-4)}`
        const { data, error: createError } = await admin.auth.admin.createUser({
          email: u.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { nombre: u.nombre },
        })
        if (createError) throw createError
        authId = data.user.id
        console.log(`Contraseña temporal para ${u.email}: ${tempPassword}`)
      }

      const { error: updateError } = await admin
        .from('usuarios')
        .update({ auth_id: authId })
        .eq('id', u.id)

      if (updateError) {
        console.error(`Usuario ${u.email}: creado en auth pero falló actualizar auth_id:`, updateError.message)
      } else {
        console.log(`Usuario ${u.email}: auth_id vinculado (${authId})`)
      }
    } catch (err) {
      console.error(`Error procesando ${u.email}:`, err.message)
    }
  }

  console.log('Migración finalizada')
}

main()
