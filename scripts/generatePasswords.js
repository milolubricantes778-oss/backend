const bcrypt = require("bcrypt")

async function generatePasswords() {
  const passwords = [
    { user: "admin", password: "admin123" },
    { user: "empleado", password: "empleado123" },
  ]

  console.log("Generando hashes de contraseñas...\n")

  for (const item of passwords) {
    const hash = await bcrypt.hash(item.password, 12)
    console.log(`${item.user}: ${item.password} -> ${hash}`)
  }
}

generatePasswords().catch(console.error)
