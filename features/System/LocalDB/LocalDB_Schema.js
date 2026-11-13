import fs from 'fs';
import path from 'path';
const DATA_DIR = path.join(process.cwd(), 'data', 'atlas');
fs.mkdirSync(DATA_DIR, { recursive: true });
function load(name){const p=path.join(DATA_DIR,name+'.json');try{return JSON.parse(fs.readFileSync(p,'utf8'))||{};}catch{return {};}}
function save(name,obj){const p=path.join(DATA_DIR,name+'.json');const t=p+'.tmp';fs.writeFileSync(t,JSON.stringify(obj,null,2));fs.renameSync(t,p);}
class MemoryModel{static init(name){this._name=name;this.store=load(name);}constructor(data={}){Object.assign(this,data);if(!this._id)this._id=`${Date.now()}-${Math.random().toString(36).slice(2)}`;}static _key(d){return String(d.id??d.plugin??d.sessionId??d._id);}static _match(d,f={}){return Object.entries(f).every(([k,v])=>d?.[k]===v);}async save(){const k=this.constructor._key(this);this.constructor.store[k]={...this};save(this.constructor._name,this.constructor.store);return this;}static async findOne(f={}){for(const d of Object.values(this.store))if(this._match(d,f))return new this(d);return null;}static async create(d={}){const x=new this(d);await x.save();return x;}static async findOneAndUpdate(f={},u={},o={}){let d=await this.findOne(f);if(!d){if(!o.upsert)return null;d=new this({...f});}Object.assign(d,u?.$set||u||{});await d.save();return d;}static async deleteOne(f={}){for(const[k,d]of Object.entries(this.store))if(this._match(d,f)){delete this.store[k];save(this._name,this.store);return{acknowledged:true,deletedCount:1};}return{acknowledged:true,deletedCount:0};}static async find(f={},p=null){const rows=[];for(const d of Object.values(this.store)){if(!this._match(d,f))continue;let x={...d};if(p&&typeof p==='object'){const ks=Object.keys(p).filter(k=>p[k]);x=ks.length?Object.fromEntries(ks.map(k=>[k,x[k]])):x;}else if(typeof p==='string'){const ks=p.split(/\s+/).filter(Boolean);x=ks.length?Object.fromEntries(ks.map(k=>[k,x[k]])):x;}rows.push(new this(x));}return rows;}}
class UserData extends MemoryModel{} UserData.init('users');
class GroupData extends MemoryModel{} GroupData.init('groups');
class SystemData extends MemoryModel{} SystemData.init('system');
class PluginData extends MemoryModel{} PluginData.init('plugins');
export {UserData as userData,GroupData as groupData,SystemData as systemData,PluginData as pluginData};
