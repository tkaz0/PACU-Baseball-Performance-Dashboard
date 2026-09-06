#!/usr/bin/env node
// Receives connector JSON through non-echoing stdin; never put source cells in shell code.
import { mkdir,realpath,writeFile } from "node:fs/promises";
import { dirname,resolve,relative,isAbsolute,sep,basename } from "node:path";
import { fileURLToPath } from "node:url";
const repo=resolve(dirname(fileURLToPath(import.meta.url)),"..");
try{
 if(process.argv.length!==3)throw new Error("Specify one private output file outside Git.");
 const output=resolve(process.argv[2]),rel=relative(repo,output);if(!rel||(!(rel===".."||rel.startsWith(".."+sep))&&!isAbsolute(rel)))throw new Error("Keep source captures outside Git.");
 await mkdir(dirname(output),{recursive:true,mode:0o700});const resolved=resolve(await realpath(dirname(output)),basename(output)),resolvedRel=relative(repo,resolved);if(!resolvedRel||(!(resolvedRel===".."||resolvedRel.startsWith(".."+sep))&&!isAbsolute(resolvedRel)))throw new Error("Keep source captures outside Git.");
 const chunks=[];let size=0,complete=false;
 for await(const chunk of process.stdin){size+=chunk.length;if(size>5*1024*1024)throw new Error("The private capture exceeds 5 MiB.");chunks.push(chunk);if(chunk.includes(10)){complete=true;break;}}
 if(!complete)throw new Error("Supply one complete JSON line through stdin.");const raw=Buffer.concat(chunks).toString("utf8");let parsed;try{parsed=JSON.parse(raw);}catch{throw new Error("The capture is not one valid JSON object.");}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)||!parsed.response)throw new Error("Supply a bounded game connector capture envelope.");
 await writeFile(resolved,JSON.stringify(parsed),{mode:0o600,flag:"wx"});process.stdout.write(JSON.stringify({written:true,bytes:Buffer.byteLength(JSON.stringify(parsed))})+"\n");
}catch(error){process.stderr.write(error instanceof Error?error.message+"\n":"Private capture write failed.\n");process.exitCode=1;}
