/**
 * VirtualSteeringWheel.js
 * Transparent overlay canvas — shows steering wheel + gesture label.
 * No camera feed, no landmarks.
 */
var VirtualSteeringWheel = (function () {

    var _cvs, _ctx;
    var _angle   = 0;
    var _visible = false;
    var _accel   = false;
    var _brake   = false;
    var _nitro   = false;
    var _hintTxt = '';
    var _hintA   = 0;
    var _gesture = 'NONE';
    var WX = 0, WY = 0, WR = 85;

    function _resize() {
        _cvs.width  = window.innerWidth;
        _cvs.height = window.innerHeight;
        WX = Math.round(_cvs.width  / 2);
        WY = Math.round(_cvs.height - WR - 20);
    }

    function _drawWheel(cx, cy, r, deg) {
        var ctx = _ctx;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(deg * Math.PI / 180);

        // Glow
        var g = ctx.createRadialGradient(0,0,r*0.6,0,0,r*1.4);
        g.addColorStop(0,'rgba(232,200,74,0.15)');
        g.addColorStop(1,'rgba(0,0,0,0)');
        ctx.beginPath(); ctx.arc(0,0,r*1.4,0,Math.PI*2);
        ctx.fillStyle=g; ctx.fill();

        // Shadow
        ctx.shadowColor='rgba(0,0,0,0.7)'; ctx.shadowBlur=16; ctx.shadowOffsetY=5;

        // Outer rim
        ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2);
        var rim = ctx.createLinearGradient(-r,-r,r,r);
        rim.addColorStop(0,'#f5e070'); rim.addColorStop(0.5,'#e8c84a'); rim.addColorStop(1,'#a07820');
        ctx.strokeStyle=rim; ctx.lineWidth=13; ctx.stroke();
        ctx.shadowBlur=0; ctx.shadowOffsetY=0; ctx.shadowColor='transparent';

        // 3 spokes
        for (var s=0; s<3; s++) {
            ctx.save(); ctx.rotate((s/3)*Math.PI*2);
            var sg = ctx.createLinearGradient(0,12,0,r-8);
            sg.addColorStop(0,'#666'); sg.addColorStop(1,'#c8a830');
            ctx.beginPath();
            ctx.moveTo(-5,12); ctx.lineTo(-4,r-8); ctx.lineTo(4,r-8); ctx.lineTo(5,12); ctx.closePath();
            ctx.fillStyle=sg; ctx.fill();
            ctx.restore();
        }

        // Hub
        ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2);
        ctx.fillStyle='#1a1a1a'; ctx.fill();
        ctx.beginPath(); ctx.arc(0,0,13,0,Math.PI*2);
        ctx.strokeStyle='#e8c84a'; ctx.lineWidth=2; ctx.stroke();
        ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2);
        ctx.fillStyle='#e8c84a'; ctx.fill();
        ctx.restore();
    }

    function _drawArc(cx, cy, r, deg) {
        if (Math.abs(deg) < 2) return;
        var ctx = _ctx;
        ctx.save(); ctx.translate(cx,cy);
        var s = -Math.PI/2;
        var e = s + deg * Math.PI/180;
        ctx.beginPath();
        ctx.arc(0,0,r+18, Math.min(s,e), Math.max(s,e));
        ctx.strokeStyle = deg>0 ? 'rgba(255,100,30,0.85)' : 'rgba(40,160,255,0.85)';
        ctx.lineWidth=5; ctx.setLineDash([5,4]); ctx.stroke(); ctx.setLineDash([]);
        ctx.restore();
    }

    function _badge(label, x, y, active) {
        var ctx = _ctx;
        ctx.save();
        ctx.fillStyle = active ? 'rgba(232,200,74,0.9)' : 'rgba(20,20,20,0.65)';
        ctx.beginPath(); ctx.rect(x-40,y-13,80,26); ctx.fill();
        ctx.fillStyle = active ? '#000' : '#888';
        ctx.font = 'bold 12px Arial'; ctx.textAlign='center';
        ctx.fillText(label, x, y+5);
        ctx.restore();
    }

    function _render() {
        requestAnimationFrame(_render);
        if (!_ctx) return;
        _ctx.clearRect(0,0,_cvs.width,_cvs.height);
        if (!_visible) return;

        // Gesture label above wheel
        var gestureName = {
            'ACCELERATE': '👍 ACCELERATE',
            'STEER_LEFT':  '🤟 STEER LEFT',
            'STEER_RIGHT': '👆 STEER RIGHT',
            'BRAKE':       '✊ BRAKE',
            'NITRO':       '🚀 NITRO',
            'NONE':        ''
        }[_gesture] || _gesture;

        if (gestureName) {
            _ctx.save();
            _ctx.font='bold 16px Arial'; _ctx.textAlign='center';
            _ctx.fillStyle='#ffffff'; _ctx.shadowColor='rgba(0,0,0,0.9)'; _ctx.shadowBlur=8;
            _ctx.fillText(gestureName, WX, WY - WR - 14);
            _ctx.restore();
        }

        _drawArc(WX, WY, WR, _angle);
        _drawWheel(WX, WY, WR, _angle);

        // Hint text
        if (_hintA > 0) {
            _ctx.save();
            _ctx.globalAlpha=_hintA;
            _ctx.font='bold 18px Arial'; _ctx.textAlign='center';
            _ctx.fillStyle='#fff'; _ctx.shadowColor='rgba(0,0,0,0.9)'; _ctx.shadowBlur=8;
            _ctx.fillText(_hintTxt, WX, WY - WR - 38);
            _ctx.restore();
            _hintA = Math.max(0, _hintA - 0.018);
        }

        // Status badges
        _badge('↑ ACCEL', WX-90, WY+WR+28, _accel);
        _badge('✊ BRAKE', WX,    WY+WR+28, _brake);
        _badge('👍 NITRO', WX+90, WY+WR+28, _nitro);

        // Degree readout
        _ctx.save();
        _ctx.font='12px Arial'; _ctx.textAlign='center'; _ctx.fillStyle='rgba(255,255,255,0.45)';
        _ctx.fillText(Math.round(_angle)+'°', WX, WY+WR+52);
        _ctx.restore();
    }

    function init() {
        _cvs = document.createElement('canvas');
        _cvs.id = 'sw-overlay';
        _cvs.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
        document.body.appendChild(_cvs);
        _ctx = _cvs.getContext('2d');
        _resize();
        window.addEventListener('resize', _resize);
        _render();
    }

    function show()         { _visible = true;  }
    function hide()         { _visible = false; }
    function setAngle(d)    { _angle = d; }
    function setGesture(g)  { _gesture = g || 'NONE'; }
    function setAccel(v)    { _accel = v; if(v){ _hintTxt='ACCELERATE'; _hintA=1; } }
    function setBrake(v)    { _brake = v; if(v){ _hintTxt='BRAKE';       _hintA=1; } }
    function setNitro(v)    { _nitro = v; if(v){ _hintTxt='🚀 NITRO!';  _hintA=1; } }

    return {
        init: init, show: show, hide: hide,
        setAngle: setAngle, setGesture: setGesture,
        setAccel: setAccel, setBrake: setBrake, setNitro: setNitro
    };
})();
