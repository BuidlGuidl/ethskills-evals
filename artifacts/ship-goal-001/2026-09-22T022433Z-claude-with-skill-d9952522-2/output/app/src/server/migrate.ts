import { db, migrate } from './db'

migrate(db())
console.log('schema up to date')
