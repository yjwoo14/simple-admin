import * as fs from 'fs';
import {spawn} from 'child_process';
import * as crypto from 'crypto';

function temp_name() : string {
    return "/tmp/"+crypto.randomBytes(48).toString('hex');
}

export function strip(crt:string) : string {
    let ans = "";
    for (const line of crt.split("\n")) {
        if (!line.startsWith("-----") || !line.endsWith("-----"))
            ans += line;
    }
    return ans;
}

export function generate_key() : Promise<string> {
    return new Promise<string>((res, rej) => {
        const p = spawn("openssl", ["ecparam", "-name", "prime256v1", "-genkey", "-noout", "-out", "-"], {stdio: ['ignore', 'pipe', 'inherit']});
        if (p.stdout === null) throw Error("should not be null");
        let key="";
        p.stdout.on('data', (data) => key += data);
        p.on('close', (code) => {
            if (code ==0 && key)
                res(key);
            else
                rej("Failed");
        });
    });
}

export function generate_ca_crt(key:string) : Promise<string> {
    return new Promise<string>((res, rej) => {
        const t1 = temp_name();
        fs.writeFileSync(t1,
            "[req]\nprompt = no\ndistinguished_name = distinguished_name\n[distinguished_name]\nC=US\n", 
            {'mode': 0o600}
        )
        const p = spawn("openssl", ["req", "-x509","-new","-nodes","-key","-","-sha256","-days","9999", "-out","-", 
            "-config", t1], {stdio: ['pipe', 'pipe', 'inherit']});
        if (p.stdin === null) throw Error("should not be null");
        p.stdin.write(key, () => p.stdin && p.stdin.end())
        if (p.stdout === null) throw Error("should not be null");
        let crt="";
        p.stdout.on('data', (data) => crt += data);
        p.on('close', (code) => {
            fs.unlink(t1, ()=>{});
            if (code ==0 && crt)
                res(crt);
            else
                rej("Failed");
        });
    });
}

export function generate_srs(key: string, cn:string) : Promise<string> {
    return new Promise<string>((res, rej) => {
        const t1 = temp_name();
        fs.writeFileSync(t1,
            "[req]\nprompt = no\ndistinguished_name = distinguished_name\n[distinguished_name]\nCN="+cn+"\n",
            {'mode': 0o400}
        )
        const p = spawn("openssl", ["req", "-new","-key","-", "-out","-", 
            "-config", t1], {stdio: ['pipe', 'pipe', 'inherit']})
        if (p.stdin === null) throw Error("should not be null");
        p.stdin.write(key, () => p.stdin && p.stdin.end())
        if (p.stdout === null) throw Error("should not be null");
        let srs="";
        p.stdout.on('data', (data) => srs += data);
        p.on('close', (code) => {
            fs.unlink(t1, ()=>{});
            if (code ==0 && srs)
                res(srs);
            else
                rej("Failed");
        });
    });
}

export function generate_crt(ca_key: string, ca_crt: string, srs:string, timeout: number=999) : Promise<string> {
    return new Promise<string>((res, rej) => {
        const t1 = temp_name();
        const t2 = temp_name();
        fs.writeFileSync(t1, srs, {'mode': 0o400});
        fs.writeFileSync(t2, ca_crt, {'mode': 0o400});
        const p = spawn("openssl", ["x509", "-req", "-days", ""+timeout, "-in", t1,
            "-CA", t2,
            "-CAkey", "-",
            "-CAcreateserial",
            "-out", "-"], {stdio: ['pipe', 'pipe', 'inherit']});
        
        if (p.stdin === null) throw Error("should not be null");
        p.stdin.write(ca_key, () => p.stdin && p.stdin.end())
        if (p.stdout === null) throw Error("should not be null");
        let crt="";
        p.stdout.on('data', (data) => crt += data);
        p.on('close', (code) => {
            fs.unlink(t1, ()=>{});
            fs.unlink(t2, ()=>{});

            if (code ==0 && crt)
                res(crt);
            else
                rej("Failed");
        });
    });
}

