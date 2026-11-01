import { randomBytes, scryptSync } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Yangi administrator paroli (kamida 12 belgi): ');
rl.close();
if (password.length < 12 || password.length > 256) {
  console.error('Parol 12–256 belgi bo‘lsin.');
  process.exit(1);
}
const salt = randomBytes(16).toString('hex');
console.log(
  '\nADMIN_PASSWORD_HASH=scrypt:' + salt + ':' + scryptSync(password, salt, 64).toString('hex'),
);
console.log('\nBu qiymatni server muhitiga joylang. ADMIN_PASSWORD ni bo‘sh qoldiring.');
