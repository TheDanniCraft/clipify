import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const require=createRequire('/home/coder/clipify/package.json');
const {Pool}=require('pg');
const base='postgresql://clipify_mcp@127.0.0.1:54419/clipify_mcp_fixture';
const admin=new Pool({connectionString:base,max:1});
const results=[];
try {
 for (const [phase,path] of [['before','/tmp/clipify-before-schema.sql'],['after','/tmp/clipify-fresh-schema.sql']]) {
  const name='mcp_'+randomUUID().replaceAll('-','');
  const url=new URL(base);url.pathname='/'+name;
  await admin.query(`CREATE DATABASE "${name}"`);
  const client=new Pool({connectionString:url.href,max:1});
  const sql=readFileSync(path,'utf8');
  const result={phase,sqlSha256:createHash('sha256').update(sql).digest('hex'),sqlBytes:Buffer.byteLength(sql),database:name};
  try {
   try {await client.query(sql);result.applied=true;}
   catch(error){result.applied=false;result.code=error.code;result.error=error.message;}
   if(phase==='before') {
    assert.equal(result.applied,false);
    assert.equal(result.code,'42830');
    assert.match(result.error,/no unique constraint matching given keys/);
   } else {
    assert.equal(result.applied,true,JSON.stringify(result));
    const expected=['runners_owner_id_unique','runner_branding_assets_owner_id_unique','stream_sessions_owner_identity','runner_destinations_owner_identity','runner_schedule_events_owner_identity','runner_admissions_owner_identity_unique'];
    const constraints=await client.query("SELECT conname FROM pg_constraint WHERE contype='u' AND conname=ANY($1::text[]) ORDER BY conname",[expected]);
    assert.deepEqual(constraints.rows.map(row=>row.conname),expected.sort());
    result.compositeUniqueConstraints=constraints.rows.map(row=>row.conname);
    const counterSql="INSERT INTO rate_limit_counters(action,signal_type,signal_hash,count,window_started_at,expires_at) VALUES('local-schema-repro','network',$1,1,now(),now()+interval '1 minute') ON CONFLICT(action,signal_type,signal_hash) DO UPDATE SET count=rate_limit_counters.count+1 RETURNING count";
    await client.query(counterSql,['a'.repeat(64)]);
    const updated=await client.query(counterSql,['a'.repeat(64)]);
    assert.equal(updated.rows[0].count,2);
    result.rateLimitConflictUpdate=true;
    result.tableCount=Number((await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema IN ('public','auth') AND table_type='BASE TABLE'")).rows[0].count);
   }
  } finally {await client.end();await admin.query(`DROP DATABASE "${name}"`);result.databaseRemoved=true;results.push(result);}
 }
 const report={ok:true,method:'Drizzle export to stdout applied directly to isolated fresh local databases; no migration files or schema-push guard override',postgresMajor:18,results};
 writeFileSync('/home/coder/clipify/specs/004-runner-free-pro/tdd/evidence/F1-fresh-drizzle-schema-red-green.json',JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
} finally {await admin.end();}
