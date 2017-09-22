$(function() {
  $("#room_select").click(function(){
    if ($("#room_id").val()=="" || $("#nickname").val()=="") {
      alert("入力してください");
      return 0;
    }else if (!/^[a-zA-Z][a-zA-Z0-9]+$/.test($("#nickname").val())) {
      alert("ニックネームには半角英字のみ使用可能です");
      return 0;
    }
    $(".start").hide();
    $("#room").text($("#room_id").val());
    $("#name").text($("#nickname").val());
    var roomName=$("#room_id").val();
    const peer = new Peer($("#nickname").val(),{
      key:   "8cca2734-94ae-44fd-af8e-84a73633d9a4",
      debug: 1
    });
    let localStream;
    let room;
    var posts;
    var members=[];
    peer.isDay=true;
    peer.night_end_count=[];
    peer.day_end_count=[];


    peer.on('open',function(){
      navigator.mediaDevices.getUserMedia({video:{width:100,height:100}, audio:true }).then(stream => {
        $('.my-video').get(0).srcObject = stream;
        // $('.my-video').attr("id",peer.id);
        localStream = stream;
        room=peer.joinRoom(roomName,{mode:"sfu",stream:localStream});
        room.game={};
        room.on('open',function(){
          //  スタートボタン
          $("#start").click(function(){
            $(this).hide();
            // 役職決定
            posts=set_posts(members.length+1);
            // 自分は先頭
            peer.post=posts[0];
            $("#post").text(peer.post);
            room.game.peers={[peer.id]:{"post":peer.post}};
            for (var i = 0; i < members.length; i++) {
              room.game.peers[members[i]]={"post":posts[i+1]};
            }
            // room.send({label:"peers",data:room.game.peers});
            room.game.day=0;
            // room.send({label:"day",data:room.game.day});
            change_and_send_alert(room,"ゲームが開始されました。今回の役職を確認してください");
            room.send({label:"startNight",data:room.game});
            Night(room,peer);
          })

          room.on("stream",function(stream){
            members.push(stream.peerId);
            $("#p_c").text(members.length+1);
            if (members.length>2) {
              $("#start").removeClass("disabled");
            }
            stream_to_tag(stream);
          })
          room.on("data",function(data){
            console.log(data);
            if(data.data.label=="alert"){
              $("#alert").text(data.data.data);
            }else if(data.data.label=="night_end_count"){
              add_when_nothing(peer.night_end_count,data.data.data)
              console.log(peer.night_end_count);

              if (room.game.peers[data.src].post=="人狼" && peer.post=="人狼") {
                $(".人狼").hide();
              }

              if (peer.night_end_count.length==Object.keys(room.game.peers).length) {
                room.game.day++;
                room.send({label:"startDay",data:room.game});
                Day(room,peer);
                peer.night_end_count=[];
              }
            }else if(data.data.label=="day_end_count"){
              if (peer.day_end_count.indexOf(data.src)==-1) {
                peer.day_end_count.push(data.src);
                if (room.game.kill_peer==undefined) {
                  room.game.kill_peer={};
                  Object.keys(room.game.peers).forEach(function (key) {
                    room.game.kill_peer[key]=0;
                  });
                }
                room.game.kill_peer[data.data.data]++;
              }

              console.log("day_end_count",peer.day_end_count);

              if (peer.day_end_count.length==Object.keys(room.game.peers).length) {
                var max=0;
                var dead_key="";
                Object.keys(room.game.kill_peer).forEach(function (key) {
                  if (room.game.kill_peer[key]>max) {
                    max=room.game.kill_peer[key];
                    dead_key=key;
                  }
                });
                console.log("殺される",room.game.kill_peer);
                room.game["dead"]=dead_key;
                room.send({label:"startNight",data:room.game});

                peer.night_end_count=[];

                Night(room,peer);
                peer.isDay=false;

                peer.day_end_count=[];
              }
            }else if(data.data.label=="startDay" && !peer.isDay){
              peer.isDay=true;
              room.game=data.data.data;
              Day(room,peer);
              peer.night_end_count=[];
            }else if(data.data.label=="startNight" && peer.isDay){
              peer.isDay=false;
              room.game=data.data.data;
              if (room.game.day==0) {
                $("#start").hide();
                peer.post=room.game.peers[peer.id].post;
                $("#post").text(peer.post);
              }
              peer.night_end_count=[];
              Night(room,peer);
              peer.day_end_count=[];
            }

            if (/^add_.*$/.test(data.data.label)) {
              var key=data.data.label.replace( /add_/g , "");
              room.game[key]=data.data.data;
            }
          })

          $(".my-video").click(function(){
            var condition={width:100,height:100};
            // 一回全部止める
            localStream.getAudioTracks()[0].stop();
            if(localStream.getVideoTracks()[0]){
              localStream.getVideoTracks()[0].stop();
              condition=false;
            }
            navigator.mediaDevices.getUserMedia({video:condition, audio:true }).then(stream => {
              localStream=stream;
              room.replaceStream(localStream);
              $('.my-video').get(0).srcObject = localStream;
            })
          })

          room.on("peerLeave",function(peerId){
            members.splice(members.indexOf(peerId),1);
            $("#p_c").text(members.length+1);
            $("p#"+peerId).remove();
            $("video#"+peerId).remove();
          })
          room.on("peerJoin",function(peerId){
          })
        })
      })
    })
  })






function change_and_send_alert(room,text) {
  $("#alert").text(text);
  room.send({label:"alert",data:text});
}

function stream_to_tag(stream) {
  if($("video#"+stream.peerId).length==0){
    $video=$("<video>");
    $("body").append($video);
    $video.attr("src",window.URL.createObjectURL(stream));
    $video.attr("id",stream.peerId);
    $video.attr("class","other-peer");
    $video.attr("autoplay",true);
    $video.attr("poster","");
    $video.show();
    var rgbColor = 'rgb(' + Math.floor(Math.random() * 256) + ',' + Math.floor(Math.random() * 256) + ',' + Math.floor(Math.random() * 256) + ')';
    $video.css('border-color', rgbColor);
    $video.draggable();
    $pe=$("<p>"+stream.peerId+"</p>");
    $pe.attr("id",stream.peerId);
    $("#peers").append($pe);
    $pe.css('color', rgbColor);;
  }else{
    // すでにDOMがあるときはstreamを入れ替える
    $("video#"+stream.peerId).attr("src",window.URL.createObjectURL(stream));
  }
}

function set_select_box(peers,selecter) {
  $(selecter).empty();
  Object.keys(peers).forEach(function (key) {
    $(selecter).append("<option value='"+key+"'>"+key+"</option>");
  });
}

function getDeadPeer(room) {
  if (room.game.dead && !room.game.guard) {
    return room.game.dead;
  }else{
    return false;
  }
}

function ViewChange(str) {
  var b_color;
  var color;
  var sound_id;

  if (str=="夜") {
    b_color="black";
    color="white";
    sound_id="se_wolf";

    $(".night").show();
    $(".day").hide();
  }else{
    b_color="white";
    color="black";
    sound_id="se_chicken";
    $(".day").show();
    $(".night").hide();
  }

  document.getElementById(sound_id).play() ;
  $("body").animate(
    {'color': color,
      'backgroundColor': b_color
    }, 1500
  );
  $("#day_night").text(str);

}

function Night(room,peer) {
  ViewChange("夜");
  if (peer.dead) {
    peer.end=true;
    return 0;
  }
  $("#alert").text("夜になりました。");
  // peer.end=false;

  room.game.kill_peer=undefined;

  var dead_peer=getDeadPeer(room);
  if (dead_peer){
    delete room.game.peers[dead_peer];
    // room.send({label:"peers",data:room.game.peers});
    if (dead_peer==peer.id) {
      $("#alert").text("多数決の結果、あなたは殺されました");
      dead_mode();
      peer.dead=true;
      // peer.end=true;
      return 0;
    }else{
      $("#alert").text(dead_peer+"が多数決で殺されました");
      $("video#"+dead_peer).addClass("dead");
      $("video#"+dead_peer).attr("muted","");
    }
  }

  set_select_box(room.game.peers,"#select");
  // 選択肢から自分を除く
  $("#select > [value="+peer.id+"]").remove();

  Object.keys(room.game.peers).forEach(function (key) {
    // 自分と相手が人狼同士以外は隠す
    if (!(peer.post=="人狼" && room.game.peers[key].post=="人狼")) {
      $("video#"+key).hide();
      $("video#"+key).attr("muted","");
    }
  });


  if (room.game.day>0 || peer.post=="占い師") {
    if (["占い師","人狼","騎士"].indexOf(peer.post) >= 0) {
      $("."+peer.post).show();
      $("button.占い師").click(function(){
        $(".night").hide();
        alert(room.game.peers[$("#select").val()].post);
        setTimeout(function () {room.send({label:"night_end_count",data:peer.id})}, 3*1000);
        add_when_nothing(peer.night_end_count,peer.id);
        // peer.end=true;
      })
      $("button.人狼").click(function(){
        $(".night").hide();
        room.game["dead"]=$("#select").val();
        room.send({label:"add_dead",data:room.game["dead"]});
        setTimeout(function () {room.send({label:"night_end_count",data:peer.id})}, 3*1000);
        add_when_nothing(peer.night_end_count,peer.id);
        // peer.end=true;
      })
      $("button.騎士").click(function(){
        $(".night").hide();
        room.game["guard"]=$("#select").val();
        room.send({label:"add_guard",data:room.game["guard"]});
        setTimeout(function () {room.send({label:"night_end_count",data:peer.id})}, 3*1000);
        add_when_nothing(peer.night_end_count,peer.id);
        // peer.end=true;
      })
    }else{
      // peer.end=true;
      add_when_nothing(peer.night_end_count,peer.id);
      setTimeout(function () {room.send({label:"night_end_count",data:peer.id})}, 10*1000);
    }
  }else{
    // peer.end=true;
    add_when_nothing(peer.night_end_count,peer.id);
    setTimeout(function () {room.send({label:"night_end_count",data:peer.id})}, 10*1000);
  }


}
function dead_mode() {
  $("#day_and_night").remove();
  $("#dead").show();
  $("video").show();
}

function add_when_nothing(ary,e) {
  if (ary.indexOf(e)==-1) {
    ary.push(e);
  }
}

function Day(room,peer) {
  ViewChange("昼");
  peer.end=false;

  var dead_peer=getDeadPeer(room);
  if (dead_peer) {
    delete room.game.peers[dead_peer];
    if (dead_peer==peer.id) {
      $("#alert").text("あなたは人狼に殺されました");
      dead_mode();
      peer.dead=true;
    }else{
      $("#alert").text(dead_peer+"は人狼に殺されました");
      $("video#"+dead_peer).addClass("dead");
      $("video#"+dead_peer).attr("muted","");
    }
  }else{
    $("#alert").text("昨晩の死者はいませんでした。殺すものを決めましょう。");
  }

  if (end_judge(room.game.peers)) {
    $("#alert").text(end_judge(room.game.peers));
    $("#day_and_night").remove();
    $("video").show();
    $("video").attr("muted",false);
    return 0;
  }

  if (peer.dead) {
    peer.end=true;
    return 0;
  }


  if (room.game.kill_peer==undefined) {
    room.game.kill_peer={};
    Object.keys(room.game.peers).forEach(function (key) {
      room.game.kill_peer[key]=0;
    });
  }
  Object.keys(room.game.peers).forEach(function (key) {
    $("video#"+key).show();
    $("video#"+key).attr("muted","false");
  });

  set_select_box(room.game.peers,"#select_day");
  $("#select_day > [value="+peer.id+"]").remove();

  $("#kill_peer").click(function(){
    $(".day").hide();
    if (peer.day_end_count.indexOf(peer.id)==-1) {
      peer.day_end_count.push(peer.id);
      room.game.kill_peer[$("#select_day").val()]++;
      room.send({label:"day_end_count",data:$("#select_day").val()});
    }
  })
}

  function end_judge(peers) {
    var wolf=0;
    var other=0;
    Object.keys(peers).forEach(function (key) {
      if (peers[key].post=="人狼") {
        wolf++;
      }else{
        other++;
      }
    });
    if (wolf>=other) {
      return "人狼側の勝利です。";
    }else if (wolf==0) {
      return "人間側の勝利です。"
    }else{
      return false;
    }
  }

  function set_posts(int) {
    var res=["占い師","人狼","騎士"];
    int-=3;
    if (int>=4) {
      res.push(["人狼","狂人"]);
      int-=2;
    }
    for (var i = 0; i < int; i++) {
      res.push("村人");
    }
    for(var i = res.length - 1; i > 0; i--){
      var r = Math.floor(Math.random() * (i + 1));
      var tmp = res[i];
      res[i] = res[r];
      res[r] = tmp;
    }
    return res;
  }
});
