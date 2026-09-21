import {it,expect} from 'vitest';
import {classifyBulkPlayers} from '@/lib/bulk-invitations';
it('excludes connected accounts, existing sign-ins, attempts, bad emails and inactive players',()=>{
 const rows=Array.from({length:8},(_,i)=>({id:String(i),code:`SYN-${i}`,name:`Fictional ${i}`,email:`fictional${i}@example.com`,eligible:true}));rows[4].email=null as unknown as string;rows[5].eligible=false;rows[6].email=rows[7].email;
 expect(classifyBulkPlayers(rows,new Set(['1']),new Set(['fictional2@example.com']),new Set(['3'])).map(r=>r.status)).toEqual(['ready','connected','existing','review','email','inactive','duplicate','duplicate']);
 expect(classifyBulkPlayers([rows[0]],new Set(),new Set(),new Set(),'fictional0@example.com')[0].status).toBe('existing');
});
