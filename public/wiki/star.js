// /stars/<designation> for a catalogue star without its own page: the designation comes from the
// URL (hip-12345, tyc-4669-731-1, gaia-dr3-4472832130942575872) and is handed to the simulation.
(() => {
  const slug = decodeURIComponent(location.pathname.replace(/\/+$/, '').split('/').pop() || '');
  let m, id = '';
  if ((m = /^hip-(\d+)$/i.exec(slug))) id = `HIP ${m[1]}`;
  else if ((m = /^tyc-(\d+)-(\d+)-(\d)$/i.exec(slug))) id = `TYC ${m[1]}-${m[2]}-${m[3]}`;
  else if ((m = /^gaia(?:-dr3)?-(\d{6,20})$/i.exec(slug))) id = `Gaia DR3 ${m[1]}`;
  else if (/^[\p{L}\p{N}-]{2,60}$/u.test(slug)) id = slug.replace(/-/g, ' ');
  if (!id) return;
  const h1 = document.querySelector('h1');
  if (h1) h1.textContent = id;
  document.title = `${id} · Your Eyes In Space`;
  const btn = document.querySelector('.w-open a');
  if (btn) {
    const href = new URL(btn.getAttribute('href') || '/', location.origin);
    href.searchParams.set('open', `find:${id}`);
    btn.setAttribute('href', href.pathname + href.search);
  }
})();
