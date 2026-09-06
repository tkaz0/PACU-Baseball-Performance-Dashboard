#!/usr/bin/env node
// Private local preparation only. No network, database access or automatic identity matching.
import { readFile,writeFile,mkdir,stat,realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { dirname,resolve,relative,isAbsolute,sep } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeGameCapture,validateGameMappings } from "../lib/game-capture.ts";
import { parseGameSource } from "../lib/game-source.ts";
import { GAME_SOURCES,GAME_CAPTURE_SHAPES } from "../lib/game-source-config.ts";
const repo=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const args=process.argv.slice(2),options={};
try{
 if(args.length%2)throw new Error("Use --source SOURCE --input PRIVATE_CAPTURE.json --output PRIVATE_PREPARED.json [--mappings PRIVATE_REVIEWED.json].");
 for(let i=0;i<args.length;i+=2){const key=args[i];if(!["--source","--input","--output","--mappings"].includes(key)||options[key])throw new Error("Invalid or duplicate preparation option.");options[key]=args[i+1];}
 const contract=GAME_SOURCES[options["--source"]];if(!Object.hasOwn(GAME_SOURCES,options["--source"])||!options["--input"]||!options["--output"])throw new Error("Choose one approved Fall source and private input/output paths.");
 const outside=async path=>{const absolute=resolve(path),parent=await realpath(dirname(absolute)),resolved=resolve(parent,absolute.split(/[\\/]/).at(-1)),rel=relative(repo,resolved);if(!rel||(!(rel===".."||rel.startsWith(".."+sep))&&!isAbsolute(rel)))throw new Error("Private game captures and mappings must stay outside the Git repository.");return resolved;};
 const requestedOutput=resolve(options["--output"]),outputRelative=relative(repo,requestedOutput);if(!outputRelative||(!(outputRelative===".."||outputRelative.startsWith(".."+sep))&&!isAbsolute(outputRelative)))throw new Error("Private game captures must stay outside the Git repository.");
 const input=await outside(options["--input"]),outputParent=resolve(dirname(requestedOutput));await mkdir(outputParent,{recursive:true,mode:0o700});const output=await outside(options["--output"]);
 if(input===output)throw new Error("Preserve the original capture in a separate file.");
 const read=async path=>{if((await stat(path)).size>5*1024*1024)throw new Error("The private input exceeds 5 MiB.");try{return JSON.parse(await readFile(path,"utf8"));}catch{throw new Error("The private input is not valid JSON.");}};
 const normalized=normalizeGameCapture(await read(input),contract,GAME_CAPTURE_SHAPES[contract.source]);
 const mappings=options["--mappings"]?validateGameMappings(await read(await outside(options["--mappings"])),contract):{identities:[],events:[]};
 const contentHash=createHash("sha256").update(JSON.stringify({source:normalized.source,spreadsheetId:normalized.spreadsheetId,sheetId:normalized.sheetId,sheetTitle:normalized.sheetTitle,cells:normalized.cells})).digest("hex");
 const snapshot={...normalized,contentHash},preview=parseGameSource(snapshot,contract,mappings.identities,mappings.events);
 const status={source:contract.source,contentHash,fetchedAt:normalized.fetchedAt,populatedRows:preview.populatedRows,observations:preview.observations.length,errors:preview.issues.filter(x=>x.severity==="error").length,reviewIssues:preview.issues.filter(x=>x.severity==="review").length,issueCodes:[...new Set(preview.issues.map(x=>x.code))],canImport:preview.canImport&&Date.parse(normalized.fetchedAt)>=Date.parse("2026-09-12T00:00:00-07:00"),mappingsReviewed:!!options["--mappings"]};
 await writeFile(output,JSON.stringify({snapshot,...mappings,status}),{mode:0o600,flag:"wx"});
 process.stdout.write(JSON.stringify(status)+"\n");
}catch(error){process.stderr.write((error instanceof Error?error.message:"Game snapshot preparation failed.")+"\n");process.exitCode=1;}
