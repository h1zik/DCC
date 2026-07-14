/**
 * Skrip anti-flicker Dominatus Lab — dirender oleh layout (lab) dan dieksekusi
 * sebelum paint pada hard load, supaya halaman Lab tidak berkedip dengan tema
 * DCC dulu. Menyetel data-theme + penanda takeover + kelas .dark sesuai
 * localStorage, dan menghapus custom property inline sisa preset "custom"
 * (inline var mengalahkan selector CSS Lab).
 *
 * Navigasi client-side ditangani LabThemeController, bukan skrip ini.
 */
const LAB_THEME_BOOT = `(function(){try{
var d=document.documentElement;
var m=localStorage.getItem("dominatus-lab-theme")==="light"?"light":"dark";
d.setAttribute("data-theme","dominatus-lab");
d.setAttribute("data-lab-theme-active","");
d.classList.toggle("dark",m==="dark");
var s=d.style,rm=[];
for(var i=0;i<s.length;i++){if(s[i].indexOf("--")===0)rm.push(s[i]);}
for(var j=0;j<rm.length;j++){s.removeProperty(rm[j]);}
}catch(e){}})();`;

export function LabThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: LAB_THEME_BOOT }} />;
}
