(function(){
  const DEFAULT_REPO = 'robert19066/HighScore';

  function parseVersion(vstr){
    const s=(vstr||'').replace(/^v/i,'').trim();
    let m=s.match(/^(\d+)\.(\d+)\.(\d+)[\- _]?[Bb](\d+)$/i);
    if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'beta',betaNum:+m[4]};
    m=s.match(/^(\d+)\.(\d+)\.(\d+)[\- _]?(?:RC|rc)(\d*)$/);
    if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'rc',rcNum:(m[4]?+m[4]:0)};
    m=s.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if(m)return{major:+m[1],minor:+m[2],patch:+m[3],type:'stable'};
    return null;
  }

  function versionIsNewer(latest,current){
    if(!latest||!current) return false;
    if(latest.major!==current.major) return latest.major>current.major;
    if(latest.minor!==current.minor) return latest.minor>current.minor;
    if(latest.patch!==current.patch) return latest.patch>current.patch;
    const order={stable:3,rc:2,beta:1};
    const la=order[latest.type]||0,cu=order[current.type]||0;
    if(la!==cu) return la>cu;
    if(latest.type==='beta'&&current.type==='beta') return (latest.betaNum||0)>(current.betaNum||0);
    if(latest.type==='rc'&&current.type==='rc') return (latest.rcNum||0)>(current.rcNum||0);
    return false;
  }

  async function getLocalVersion(path='assets/vrsn.txt'){
    // Try several candidate relative paths so this works from code/html/* or project root
    const candidates=[path, '../'+path, '../../'+path, '../../../'+path, '/'+path];
    for(const p of candidates){
      try{
        const r=await fetch(p,{cache:'no-store'});
        if(!r.ok) continue;
        const t=(await r.text()).trim();
        if(t) return t.replace(/^v/i,'');
      }catch(e){/* try next */}
    }
    return '';
  }

  async function fetchReleases(repo){
    const url=`https://api.github.com/repos/${repo}/releases?per_page=20`;
    const res=await fetch(url,{headers:{'Accept':'application/vnd.github.v3+json'},cache:'no-store'});
    if(!res.ok)throw new Error('GitHub API error');
    return res.json();
  }

  function findExeAsset(release){
    if(!release||!release.assets) return null;
    return release.assets.find(a=>a.name.toLowerCase().endsWith('.exe'))||null;
  }

  // channel: 'stable' or 'beta' (prereleases)
  async function checkForUpdates(opts={repo:DEFAULT_REPO,localPath:'assets/vrsn.txt',channel:'stable'}){
    const localRaw=await getLocalVersion(opts.localPath);
    const curParsed=parseVersion(localRaw||'');
    if(!curParsed) return null;

    try{
      if(opts.channel==='stable'){
        // latest stable release
        const r=await fetch(`https://api.github.com/repos/${opts.repo}/releases/latest`,{headers:{'Accept':'application/vnd.github.v3+json'},cache:'no-store'});
        if(!r.ok) return null;
        const rel=await r.json();
        const ver=parseVersion(rel.name||rel.tag_name||'');
        if(ver&&versionIsNewer(ver,curParsed)){
          const exe=findExeAsset(rel);
          return {release:rel,parsed:ver,exe:exe};
        }
        return null;
      }else{
        // beta channel: look for latest prerelease (or any prerelease)
        const list=await fetchReleases(opts.repo);
        let best=null,bestP=null;
        for(const rel of list){
          if(!rel.prerelease) continue;
          const ver=parseVersion(rel.name||rel.tag_name||'');
          if(!ver) continue;
          if(versionIsNewer(ver,curParsed)){
            if(!bestP||versionIsNewer(ver,bestP)){bestP=ver;best=rel;}
          }
        }
        if(best&&bestP){
          const exe=findExeAsset(best);
          return {release:best,parsed:bestP,exe:exe};
        }
        return null;
      }
    }catch(e){console.warn('UpdateChecker error',e);return null;}
  }

  // helper: compare parsed version objects (a > b => positive)
  function compareParsed(a,b){
    if(!a && !b) return 0;
    if(!a) return -1;
    if(!b) return 1;
    if(a.major!==b.major) return a.major-b.major;
    if(a.minor!==b.minor) return a.minor-b.minor;
    if(a.patch!==b.patch) return a.patch-b.patch;
    const order={stable:3,rc:2,beta:1};
    const oa=order[a.type]||0, ob=order[b.type]||0;
    if(oa!==ob) return oa-ob;
    if(a.type==='beta'&&b.type==='beta') return (a.betaNum||0)-(b.betaNum||0);
    if(a.type==='rc'&&b.type==='rc') return (a.rcNum||0)-(b.rcNum||0);
    return 0;
  }

  // Get the most recent N releases for a channel (stable or beta). Returns array of {release,parsed,exe}
  const _releaseCache = {};
  async function getRecentReleases(opts={repo:DEFAULT_REPO,channel:'stable',count:3,force:false}){
    const repo = opts.repo||DEFAULT_REPO;
    const channel = opts.channel||'stable';
    const count = Math.max(1,Math.min(10,parseInt(opts.count)||3));
    const key = `${repo}|${channel}|${count}`;
    const now = Date.now();
    if(!opts.force && _releaseCache[key] && (now - _releaseCache[key].ts) < 60*1000){
      return _releaseCache[key].data.slice();
    }
    try{
      const list = await fetchReleases(repo);
      const filtered = list.filter(rel=>!rel.draft && (channel==='stable'? !rel.prerelease : rel.prerelease));
      const mapped = filtered.map(rel=>{
        const verStr=(rel.name&&rel.name.trim())?rel.name.trim():rel.tag_name||'';
        const parsed = parseVersion(verStr);
        return {release:rel,parsed:parsed,exe:findExeAsset(rel)};
      });
      // sort: parsed versions first (descending), fallback to published_at
      mapped.sort((a,b)=>{
        if(a.parsed && b.parsed) return compareParsed(b.parsed,a.parsed);
        if(a.parsed) return -1;
        if(b.parsed) return 1;
        const ta = new Date(a.release.published_at||a.release.created_at||0).getTime();
        const tb = new Date(b.release.published_at||b.release.created_at||0).getTime();
        return tb-ta;
      });
      const out = mapped.slice(0,count);
      _releaseCache[key] = {ts:now,data:out};
      return out;
    }catch(e){console.warn('getRecentReleases error',e);return []}
  }

  async function downloadRelease(release){
    const exe=findExeAsset(release);
    if(!exe){ if(release&&release.html_url) window.open(release.html_url,'_blank'); return false; }
    try{ window.open(exe.browser_download_url,'_blank'); return true; }catch(e){ if(release&&release.html_url) window.open(release.html_url,'_blank'); return false; }
  }

  window.UpdateChecker={parseVersion,versionIsNewer,checkForUpdates,downloadRelease,getLocalVersion,getRecentReleases};
})();