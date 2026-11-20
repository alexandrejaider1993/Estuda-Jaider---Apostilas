/* Animações por passos nas Apostilas interativas (padrão v6.3, 19/11/2026, pedido do usuário).
   Roda dentro do quadro da apostila, como o estojo. Dá vida a qualquer bloco `.anim` (item ['anim', nome, ...] do site,
   HTML em D.anims): Anterior/Próximo/Recomeçar, camadas data-v="a-b" e a pergunta "Antes de avançar" com opções que
   libera o Próximo só no acerto. Errou: "Ainda não", o porquê (data-why), reler o passo e "Tentar de novo"; a certa
   nunca aparece. Sites que já trazem o próprio script (marca anim-v2) ficam com ele. Formato: projeto "Algoritimo de
   estudo", claude/animacao-por-passos.md. */
(function(){
  if (window.ejAnim) return;
  var marca = '/*anim-' + 'v2*/', eu = document.currentScript;
  var proprio = [].some.call(document.scripts, function(s){ return s !== eu && (s.textContent || '').indexOf(marca) >= 0; });
  window.ejAnim = { versao: 1, proprio: proprio };
  if (proprio) return;
  if (!document.getElementById('ej-anim-css')) {
    var st = document.createElement('style'); st.id = 'ej-anim-css';
    st.textContent = '.anim{border:1px solid #e3e6ea;border-radius:14px;padding:12px 14px 14px;background:#fff}\n.anim>svg{max-width:600px;margin:0 auto}\n.anim [data-v]{opacity:0;transition:opacity .6s ease}\n.anim [data-v].on{opacity:1}\n.anim .anim-txt{min-height:5.2em;margin:6px 2px 8px}\n.anim .anim-txt h4{margin:0 0 4px;font:600 16px/1.3 var(--org),Inter,sans-serif}\n.anim .anim-txt p{margin:0 0 4px}\n.anim .anim-txt .q{color:#2f5f9e;font:500 14.5px/1.4 var(--org),Inter,sans-serif}\n.anim .anim-nav{display:flex;align-items:center;gap:10px;flex-wrap:wrap}\n.anim .anim-nav button{font:600 15px var(--org),Inter,sans-serif;padding:9px 16px;border-radius:10px;border:1px solid #2f5f9e;background:#fff;color:#2f5f9e;cursor:pointer;min-height:42px}\n.anim .anim-nav button[data-anav="prox"]{background:#2f5f9e;color:#fff}\n.anim .anim-nav button:disabled{opacity:.35;cursor:default}\n.anim .anim-dots{display:flex;gap:6px;margin-left:auto}\n.anim .anim-dots i{width:9px;height:9px;border-radius:50%;background:#d5dbe3;display:block}\n.anim .anim-dots i.on{background:#2f5f9e}\n@media (prefers-reduced-motion: reduce){.anim *{transition:none!important}}\n.anim .aq{margin:6px 0 2px}\n.anim .aq-ops{display:flex;flex-direction:column;gap:6px;margin:6px 0}\n.anim .aq-op{text-align:left;font:500 15px/1.35 var(--org),Inter,sans-serif;padding:9px 12px;border-radius:10px;border:1px solid #cfd6df;background:#fff;color:#1d2633;cursor:pointer;min-height:42px}\n.anim .aq-op:hover:not(:disabled){border-color:#2f5f9e}\n.anim .aq-op:disabled{cursor:default;opacity:.75}\n.anim .aq-op.certo{border-color:#2e7d4f;background:#e8f4ec;opacity:1}\n.anim .aq-op.errado{border-color:#b0413e;background:#fbeceb;opacity:1}\n.anim .aq-fb{font:14.5px/1.45 var(--org),Inter,sans-serif;margin:4px 0}\n.anim .aq-fb .ok{color:#2e7d4f}.anim .aq-fb .no{color:#b0413e}\n.anim .aq-fb button{margin-left:8px;font:600 14px var(--org),Inter,sans-serif;padding:6px 12px;border-radius:8px;border:1px solid #2f5f9e;background:#fff;color:#2f5f9e;cursor:pointer}\n.anim .anim-trava{font:13.5px var(--org),Inter,sans-serif;color:#5a6472}';
    document.head.appendChild(st);
  }

  function ok(a){return (a.dataset.ok||'').split(',').filter(Boolean);}
  function set(a,s){
    a.dataset.s=s;
    a.querySelectorAll('[data-v]').forEach(function(el){var r=el.getAttribute('data-v').split('-');el.classList.toggle('on',s>=+r[0]&&s<=+r[1]);});
    var ds=a.querySelectorAll('.anim-txt>div');
    ds.forEach(function(d,i){d.hidden=i!==s;});
    a.querySelectorAll('.anim-dots i').forEach(function(d,i){d.classList.toggle('on',i===s);});
    var n=+a.dataset.n,p=a.querySelector('[data-anav=ant]'),q=a.querySelector('[data-anav=prox]'),tv=a.querySelector('.anim-trava');
    var temQ=ds[s]&&ds[s].querySelector('.aq'),feito=ok(a).indexOf(String(s))>=0,trava=!!temQ&&!feito;
    if(p)p.disabled=s===0; if(q)q.disabled=s===n-1||trava; if(tv)tv.hidden=!trava;
  }
  document.addEventListener('click',function(e){
    var t=e.target; if(!t.closest)return;
    var op=t.closest('.aq-op');
    if(op){
      var a=op.closest('.anim'),aq=op.closest('.aq'),fb=aq.querySelector('.aq-fb'),s=+a.dataset.s;
      aq.querySelectorAll('.aq-op').forEach(function(b){b.disabled=true;});
      if(op.getAttribute('data-ok')==='1'){
        op.classList.add('certo');
        fb.innerHTML='<b class="ok">Isso.</b> Avance para ver o próximo passo.';
        var l=ok(a); if(l.indexOf(String(s))<0)l.push(String(s)); a.dataset.ok=l.join(','); set(a,s);
      }else{
        op.classList.add('errado');
        fb.innerHTML='<b class="no">Ainda não.</b> '+op.getAttribute('data-why')+' Releia o texto deste passo. <button type="button" data-aretry>Tentar de novo</button>';
      }
      return;
    }
    var r=t.closest('[data-aretry]');
    if(r){var aq2=r.closest('.aq');aq2.querySelectorAll('.aq-op').forEach(function(b){b.disabled=false;b.classList.remove('errado');});aq2.querySelector('.aq-fb').innerHTML='';return;}
    var b=t.closest('[data-anav]'); if(!b)return;
    var a2=b.closest('.anim'); if(!a2)return; e.preventDefault();
    var s2=+a2.dataset.s,n=+a2.dataset.n,k=b.getAttribute('data-anav');
    set(a2,k==='prox'?Math.min(n-1,s2+1):k==='ant'?Math.max(0,s2-1):0);
  });

})();
