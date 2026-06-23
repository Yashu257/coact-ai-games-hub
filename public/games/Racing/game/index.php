<!DOCTYPE html>
<html>
    <head>
        <title>CAR RUSH</title>
        <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-+0n0xVW2eSR5OomGNYDnhzAbDsOXxcvSN1TPprVMTNDbiYZCxYbOOl7+AMvyTG2x"
      crossorigin="anonymous"
    />
        <link rel="stylesheet" href="css/reset.css" type="text/css">
        <link rel="stylesheet" href="css/main.css" type="text/css">
        <link rel="stylesheet" href="css/orientation_utils.css" type="text/css">
        <link rel="stylesheet" href="css/ios_fullscreen.css" type="text/css">
        <link rel='shortcut icon' type='image/x-icon' href='./favicon.ico' />
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">

        <meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, minimal-ui" />
	<meta name="msapplication-tap-highlight" content="no"/>

        <script type="text/javascript" src="js/jquery-2.0.3.min.js"></script>
        <script type="text/javascript" src="js/createjs.min.js"></script>
        <script type="text/javascript" src="js/screenfull.js"></script>
        <script type="text/javascript" src="js/platform.js"></script>
        <script type="text/javascript" src="js/ios_fullscreen.js"></script>
        <script type="text/javascript" src="js/howler.min.js"></script>
        <script type="text/javascript" src="js/ctl_utils.js"></script>
        <script type="text/javascript" src="js/sprite_lib.js"></script>
        <script type="text/javascript" src="js/settings.js"></script>
        <script type="text/javascript" src="js/CLang.js"></script>
        <script type="text/javascript" src="js/CPreloader.js"></script>
        <script type="text/javascript" src="js/CMain.js"></script>
        <script type="text/javascript" src="js/CCreditsPanel.js"></script>
        <script type="text/javascript" src="js/CTextButton.js"></script>
        <script type="text/javascript" src="js/CToggle.js"></script>
        <script type="text/javascript" src="js/CGfxButton.js"></script>
        <script type="text/javascript" src="js/CMenu.js"></script>
        <script type="text/javascript" src="js/CGame.js"></script>
        <script type="text/javascript" src="js/CInterface.js"></script>
        <script type="text/javascript" src="js/CHelpPanel.js"></script>
        <script type="text/javascript" src="js/CEndPanel.js"></script>
        <script type="text/javascript" src="js/CPlayer.js"></script>
        <script type="text/javascript" src="js/CRenderer.js"></script>
        <script type="text/javascript" src="js/CRoad.js"></script>
        <script type="text/javascript" src="js/CCar.js"></script>
        <script type="text/javascript" src="js/CLevelBuilder.js"></script>
        <script type="text/javascript" src="js/CWorldMenu.js"></script>
        <script type="text/javascript" src="js/CTrackMenu.js"></script>
        <script type="text/javascript" src="js/CLevelBut.js"></script>
        <script type="text/javascript" src="js/levelsettings.js"></script>
        <script type="text/javascript" src="js/CHorizon.js"></script>
        <script type="text/javascript" src="js/CBackground.js"></script>
        <script type="text/javascript" src="js/CNextLevelPanel.js"></script>
        <script type="text/javascript" src="js/CRollingText.js"></script>
        <script type="text/javascript" src="js/CLocalStorage.js"></script>
        <script type="text/javascript" src="js/CLosePanel.js"></script>
        <script type="text/javascript" src="js/CTimer.js"></script>
        <script type="text/javascript" src="js/CTachometer.js"></script>
        <script type="text/javascript" src="js/CMsgBox.js"></script>
        <script type="text/javascript" src="js/CTremble.js"></script>
        <script type="text/javascript" src="js/CAreYouSurePanel.js"></script>
        <script type="text/javascript" src="js/CCTLText.js"></script>
        <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
        
    </head>
    <body ondragstart="return false;" ondrop="return false;" >
	<div style="position: fixed; background-color: transparent; top: 0px; left: 0px; width: 100%; height: 100%"></div>
          <script>
              var session_id, email_id, username;
      const apiUrl = "https://4bdeotpg41.execute-api.ap-south-1.amazonaws.com/prod";
            $(document).ready(function(){
                     var oMain = new CMain({
                                            /////////////PLAYER SETTINGS
                                            player_max_speed: 12000,            //SET MAX SPEED OF THE PLAYER
                                            player_maxspeed_indicator: 200,     //VALUE ON THE TACHOMETER, WHEN PLAYER REACH THE MAX SPEED. YOU CAN CHANGE THE UNITS IN CLANG.
                                            player_centrifugal_force: 0.3,      //CENTRIFUGAL FORCE VALUE WHEN IN CURVE.
                                            
                                            /////////////SCORE SETTINGS
                                            points_per_seconds_remaining: 100, //Number of points gained per seconds remaining  
                                            
                                            /////////////GENERAL SETTINGS
                                            audio_enable_on_startup:false, //ENABLE/DISABLE AUDIO WHEN GAME STARTS 
                                            fullscreen:true,            //SET THIS TO FALSE IF YOU DON'T WANT TO SHOW FULLSCREEN BUTTON
                                            check_orientation:true     //SET TO FALSE IF YOU DON'T WANT TO SHOW ORIENTATION ALERT ON MOBILE DEVICES   
                                            
                                            
                                           });

                                           axios.get(apiUrl + '/leaderboard/23').then(function (res) {
          displayLeaderboard(res.data.body);
        })
        .catch(function (error) {
          console.log(error);
        });
                                           
                                           
                    $(oMain).on("start_session", function(evt) {
                            if(getParamValue('ctl-arcade') === "true"){
                                parent.__ctlArcadeStartSession();
                            }
                            //...ADD YOUR CODE HERE EVENTUALLY
                    });
                     
                    $(oMain).on("end_session", function(evt) {
                           if(getParamValue('ctl-arcade') === "true"){
                               parent.__ctlArcadeEndSession();
                           }
                           //...ADD YOUR CODE HERE EVENTUALLY
                    });

                    $(oMain).on("restart_level", function(evt, iLevel) {
                           if(getParamValue('ctl-arcade') === "true"){
                               parent.__ctlArcadeRestartLevel({level:iLevel});
                           }
                           //...ADD YOUR CODE HERE EVENTUALLY
                    });

                    $(oMain).on("save_score", function(evt,iScore, szMode) {
                        console.log(iScore);
                           if(getParamValue('ctl-arcade') === "true"){
                               parent.__ctlArcadeSaveScore({score:iScore, mode: szMode});
                           }
                           //...ADD YOUR CODE HERE EVENTUALLY
                    });

                    $(oMain).on("start_level", function(evt, iLevel) {
                           if(getParamValue('ctl-arcade') === "true"){
                               parent.__ctlArcadeStartLevel({level:iLevel});
                           }
                           //...ADD YOUR CODE HERE EVENTUALLY
                    });

                    $(oMain).on("end_level", function(evt,iLevel) {
                           if(getParamValue('ctl-arcade') === "true"){
                               parent.__ctlArcadeEndLevel({level:iLevel});
                           }
                           //...ADD YOUR CODE HERE EVENTUALLY
                    });

                    $(oMain).on("show_interlevel_ad", function(evt) {
                           if(getParamValue('ctl-arcade') === "true"){
                               parent.__ctlArcadeShowInterlevelAD();
                           }
                           //...ADD YOUR CODE HERE EVENTUALLY
                    });
                    
                    $(oMain).on("share_event", function(evt, iScore) {
                        console.log(iScore);
                           if(getParamValue('ctl-arcade') === "true"){
                               parent.__ctlArcadeShareEvent({   img: TEXT_SHARE_IMAGE,
                                                                title: TEXT_SHARE_TITLE,
                                                                msg: TEXT_SHARE_MSG1 + iScore + TEXT_SHARE_MSG2,
                                                                msg_share: TEXT_SHARE_SHARE1 + iScore + TEXT_SHARE_SHARE1});
                           }
                           //...ADD YOUR CODE HERE EVENTUALLY
                    });
					 
                    if(isIOS()){ 
                        setTimeout(function(){sizeHandler();},200); 
                    }else{ sizeHandler(); } 
                    const displayLeaderboard = (data) => {
          data = data.sort((a,b) => {
            if(a.score === b.score) {
              return b.updatedAt - a.updatedAt;
            }
            return b.score - a.score;
          })
          let html = '';
          data.forEach((ele, idx) => {
            html += `<tr>
                  <th>${idx + 1}</th>
                  <td>${ele.username}</td>
                  <td>${ele.score}</td>
                </tr>`
          })

          document.querySelector('#leaderboard tbody').innerHTML = html;
        }
                                         
           });

        </script>
        
        <div class="check-fonts">
            <p class="check-font-1">ArialBold</p>
            <p class="check-font-2">Digital</p>
        </div> 
        
        <canvas id="canvas" class='ani_hack' width="1600" height="960"> </canvas>
        <div data-orientation="landscape" class="orientation-msg-container"><p class="orientation-msg-text">Please rotate your device</p></div>
        <div id="block_game" style="position: fixed; background-color: transparent; top: 0px; left: 0px; width: 100%; height: 100%; display:none"></div>
        <div class="leaderboard">
            <div class="container-fluid g-0">
              <div class="row g-0">
                <div class="col-12 col-md-6 col-lg-4 mx-auto">
                  <table class="table table-striped" id="leaderboard">
                    <thead>
                      <tr>
                        <th scope="col">#</th>
                        <th scope="col">Username</th>
                        <th scope="col">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
    </body>
</html>
