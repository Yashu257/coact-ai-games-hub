var LOCALSTORAGE_TIMES = "times";
var LOCALSTORAGE_TOTALSCORE = "totalscore";

var s_aTimeScore = new Array();
var s_iTotalScore = 0;



function CLocalStorage(szName){
    var _bLocalStorage = true;

    this._init = function(szName){   
        try{
            var bFlag = window.localStorage.getItem(szName);
            this.resetData();
            if(bFlag !== null && bFlag !== undefined){  
                this.loadData();
            }
        }catch(e){
            this.resetData();
        }        
        
    };

    this.isDirty = function(){
        for (var i = 0; i <s_aTimeScore.length; i++) {
            if(s_aTimeScore[i] > 0){
                return true;
            }
        }
        return false;
    };

    this.isUsed = function(){
        try{
            window.localStorage.setItem("ls_available","ok");
            window.localStorage.removeItem("ls_available");
        }catch(evt){
            _bLocalStorage = false;
        }
        
        return _bLocalStorage;
    };

    this.resetData = function(){

        s_aTimeScore = new Array();
        for(var i=0; i<NUM_TRACKS_PER_WORLD*NUM_WORLDS; i++){
            s_aTimeScore[i] = 0;
        }
        
        s_iTotalScore = 0;

    };

    this.deleteData = function(){
        try{ window.localStorage.removeItem(szName); }catch(e){}
    };

    this.saveData = function(){
        try{
            var oJSONData = {};
            oJSONData[LOCALSTORAGE_TIMES] = s_aTimeScore;
            oJSONData[LOCALSTORAGE_TOTALSCORE] = s_iTotalScore;
            window.localStorage.setItem(szName, JSON.stringify(oJSONData));
        }catch(e){}
    };

    this.loadData = function(){
        try{
            var szData = JSON.parse(window.localStorage.getItem(szName));
            
            var aLoadedScore = szData[LOCALSTORAGE_TIMES];
            s_aTimeScore = new Array();
            for(var i=0; i<aLoadedScore.length; i++){
                s_aTimeScore[i] = parseInt(aLoadedScore[i]);
            }
            
            var iLoadedScore = szData[LOCALSTORAGE_TOTALSCORE];
            s_iTotalScore = parseInt(iLoadedScore);
        }catch(e){
            this.resetData();
        }
    };

    this._init(szName);

}