import { chromium } from 'playwright';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const p=await b.newPage({viewport:{width:1280,height:800}});
const errs=[]; p.on('pageerror',e=>errs.push(String(e.message).slice(0,200)));
await p.goto('http://127.0.0.1:8080',{waitUntil:'domcontentloaded',timeout:120000});
await p.waitForTimeout(8000);
const txt=async(tag)=>{const t=await p.evaluate(()=>{
  const out=[];
  for(const e of document.querySelectorAll('button,[role=button]')){ if(e.offsetParent&&(e.innerText||'').trim()) out.push((e.innerText||'').trim().slice(0,40)); }
  return {buttons:[...new Set(out)].slice(0,25), dbg:Object.keys(window.__BF_DEBUG||{}), body:(document.body.innerText||'').replace(/\s+/g,' ').slice(0,260)};
});
console.log('\n### '+tag); console.log('  buttons:',JSON.stringify(t.buttons)); console.log('  __BF_DEBUG:',t.dbg.join(',')||'(none)'); console.log('  text:',t.body);};
await txt('boot');
await p.click('body'); await p.keyboard.press('Enter'); await p.waitForTimeout(5000);
await txt('after Enter');
const click=(s)=>p.evaluate(x=>{const rx=new RegExp(x,'i');const el=[...document.querySelectorAll('button,[role=button],div,span')].find(e=>rx.test((e.innerText||'').trim())&&e.offsetParent!==null&&(e.innerText||'').length<90);if(!el)return false;el.click();return true;},s);
console.log('  click VERSUS:', await click('^VERSUS$')); await p.waitForTimeout(4000); await txt('after VERSUS');
console.log('  click BANNON:', await click('^BANNON$')); await p.waitForTimeout(2500);
console.log('  click VIPER:', await click('^VIPER$')); await p.waitForTimeout(2500); await txt('after picks');
console.log('  click FIGHT!:', await click('^FIGHT!$')); await p.waitForTimeout(8000); await txt('after FIGHT');
console.log('  click CONFIRM:', await click('CONFIRM')); await p.waitForTimeout(30000); await txt('after CONFIRM +30s');
console.log('\npage errors:',errs.length); errs.slice(0,5).forEach(e=>console.log('  !',e));
await p.screenshot({path:'/tmp/claude-0/arena.png'});
await b.close();
