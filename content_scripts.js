//1.2.1.0
const forceBrowserDefault = function(e){
	e.stopImmediatePropagation();
	return true;
};
var EKUA;
var EKFA;
function CancelReadOnly(){
    var EKUserAnswer = document.getElementsByTagName('textarea')
	var EKfinalAnswer = document.getElementsByClassName("nan-qa-correct")
	try{
		for (let i=0;i<EKUserAnswer.length;i++){
			EKUserAnswer[i].addEventListener('click',CLICKKAITO,false)
			//EKUserAnswer[i].readOnly = false;
			EKUA=EKUserAnswer[i];
			EKFA=EKfinalAnswer[i];


		}
		var AllALCItem = document.children;
		console.log("GETALLTAG");
		for(i=0; i<AllALCItem.length; i++){
			AllALCItem[i].removeAttribute("disabled");
			console.log("DISABELED");

		}
    }catch{console.log("ERROR");}
		
}
	var alcBodyARRAY = document.getElementsByTagName("html")
	var alcbody = alcBodyARRAY[0]

	var ELKLObserve = new MutationObserver(CancelReadOnly);
	const config = {childList: true,subtree: true,characterData: true,subtree: true}
 function CLICKKAITO(){
	 EKUA.value = EKFA.innerHTML
			EKUA.dispatchEvent(new Event('change'))
	 
	 
 }


    document.addEventListener('beforecopy', forceBrowserDefault, true);
	document.addEventListener('beforecut', forceBrowserDefault, true);
	document.addEventListener('contextmenu', forceBrowserDefault, true);
	document.addEventListener('copy', forceBrowserDefault, true);
	document.addEventListener('dragstart', forceBrowserDefault, true);
	document.addEventListener('mousedown', forceBrowserDefault, true);
	document.addEventListener('mouseup', forceBrowserDefault, true);
    document.addEventListener('cut', forceBrowserDefault, true);
    document.addEventListener('paste', forceBrowserDefault, true);
	document.addEventListener('selectstart', forceBrowserDefault, true);
	document.addEventListener('click', CancelReadOnly, false);
	document.addEventListener('fullscreenchange',function(){if(document.fullscreenElement != null){document.exitFullscreen();}else{;};},true);
	console.log("EvScreenOK")
	CancelReadOnly;
	ELKLObserve.observe(alcbody,config);
	
if(false){	
var NOTPOPUPALC = document.getElementsByTagName("a"); 
for (i=0;i<NOTPOPUPALC.length;i++) { 
if (NOTPOPUPALC[i].target=="_blank" ) { 
    NOTPOPUPALC[i].target="_top" 
    } 
}
}else{;};
