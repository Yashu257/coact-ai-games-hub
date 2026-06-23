var CANVAS_WIDTH = 1360;
var CANVAS_HEIGHT = 640;

var CANVAS_WIDTH_HALF = CANVAS_WIDTH * 0.5;
var CANVAS_HEIGHT_HALF = CANVAS_HEIGHT * 0.5;

var EDGEBOARD_X = 250;
var EDGEBOARD_Y = 20;

var DISABLE_SOUND_MOBILE = false;
var FONT_GAME = "TradeGothic";

var FPS = 30;

var FPS_DESKTOP = 60;

var FPS_TIME = 1 / FPS;

var ROLL_BALL_RATE = 60 / FPS;

var STATE_LOADING = 0;
var STATE_MENU = 1;
var STATE_HELP = 1;
var STATE_GAME = 3;

var ON_MOUSE_DOWN = 0;
var ON_MOUSE_UP = 1;
var ON_MOUSE_OVER = 2;
var ON_MOUSE_OUT = 3;
var ON_DRAG_START = 4;
var ON_DRAG_END = 5;
var ON_TWEEN_ENDED = 6;
var ON_BUT_NO_DOWN = 7;
var ON_BUT_YES_DOWN = 8;

var STEP_RATE = 1.5;

var TEXT_SIZE = [80, 100, 130];

var LOCAL_BEST_SCORE = 0;

var START_HAND_SWIPE_POS = {x: CANVAS_WIDTH_HALF, y: CANVAS_HEIGHT_HALF + 200};
var END_HAND_SWIPE_POS = [{x: CANVAS_WIDTH_HALF - 250, y: CANVAS_HEIGHT_HALF - 200}, {x: CANVAS_WIDTH_HALF, y: CANVAS_HEIGHT_HALF - 200},
    {x: CANVAS_WIDTH_HALF + 250, y: CANVAS_HEIGHT_HALF - 200}];
var MS_TIME_SWIPE_END = 1000;

var MS_TIME_SWIPE_START = 3000;

var MS_TIME_FADE_HELP_TEXT = 500;

var LOCALSTORAGE_STRING = ["penalty_best_score"];

var TEXT_EXCELLENT_COLOR = ["#fff", "#5d96fe"];

var TEXT_COLOR = "#ffffff";
var TEXT_COLOR_1 = "#ff2222";

var TEXT_COLOR_STROKE = "#002a59";

var OUTLINE_WIDTH = 1.5;

var TIME_INTERVAL_STROBE = 0.2;

var PHYSICS_ACCURACY = 3;

var MOBILE_OFFSET_GLOVES_X = -100;

var BALL_VELOCITY_MULTIPLIER = 1;

var PHYSICS_STEP = 1 / (FPS * STEP_RATE);

var MS_WAIT_SHOW_GAME_OVER_PANEL = 250;

var STATE_INIT = 0;
var STATE_PLAY = 1;
var STATE_FINISH = 2;
var STATE_PAUSE = 3;

var IDLE = 0;
var RIGHT = 1;
var LEFT = 2;
var CENTER_DOWN = 3;
var CENTER_UP = 4;
var LEFT_DOWN = 5;
var RIGHT_DOWN = 6;

var ANIM_GOAL_KEEPER_FAIL = [LEFT, RIGHT, CENTER_DOWN, CENTER_UP, LEFT_DOWN, RIGHT_DOWN];

var ANIM_GOAL_KEEPER_FAIL_ALT = [LEFT, RIGHT, LEFT_DOWN, RIGHT_DOWN];

var NUM_SPRITE_PLAYER = 31;

var SPRITE_NAME_GOALKEEPER = ["gk_idle_", "gk_save_right_", "gk_save_left_", "gk_save_center_down_", "gk_save_center_up_", "gk_save_down_left_", "gk_save_down_right"];

var NUM_SPRITE_GOALKEEPER = [24, 34, 34, 51, 25, 34, 34];

var OFFSET_CONTAINER_GOALKEEPER = [{x: 0, y: 0}, {x: 15, y: -29}, {x: -360, y: -29}, {x: -15, y: -15}, {x: -20, y: -85}, {x: -355, y: 20}, {x: 21, y: 20}];

var BALL_MASS = 0.5;

var BALL_RADIUS = 0.64;

var BALL_LINEAR_DAMPING = 0.2;

var OBJECT;

var TIME_TRY_TO_SHOT_BALL_OPPONENT = 0.7;

var START_POS_FLAG = {x: 277, y: 268};

var FLAG_ADDED_POS = {x: 61, y: 69};

var FLAG_LIMIT_POS_X = 690;

var TOT_TEAM = 32;

var MIN_BALL_VEL_ROTATION = 0.1;

var TIME_RESET_AFTER_GOAL = 1000;

var SHOOT_FRAME = 7;

var HAND_KEEPER_ANGLE_RATE = 0.15;

var TIME_POLE_COLLISION_RESET = 1000;

var LIMIT_HAND_RANGE_POS = {x: 16.8, zMax: 3.1, zMin: -8.5};

var BACK_WALL_GOAL_SIZE = {width: 20.5, depth: 1, height: 7.5};

var LEFT_RIGHT_WALL_GOAL_SIZE = {width: 0.1, depth: 25, height: 7.5};

var UP_WALL_GOAL_SIZE = {width: 20.5, depth: 25, height: 0.1};

var BACK_WALL_GOAL_POSITION = {x: 0, y: 155, z: -2.7};

var GOAL_LINE_POS = {x: 0, y: BACK_WALL_GOAL_POSITION.y - UP_WALL_GOAL_SIZE.depth + 2, z: BACK_WALL_GOAL_POSITION.z};

var POSITION_BALL = {x: 0.05, y: 15.4, z: -9 + BALL_RADIUS};

var NUM_AREA_GOAL = {h: 3, w: 5};

var AREA_GOALS_ANIM = [LEFT, LEFT, CENTER_UP, RIGHT, RIGHT,
    LEFT, LEFT, CENTER_UP, RIGHT, RIGHT,
    LEFT_DOWN, LEFT_DOWN, CENTER_DOWN, RIGHT_DOWN, RIGHT_DOWN];

var GOAL_SPRITE_SWAP_Y = GOAL_LINE_POS.y;
var GOAL_SPRITE_SWAP_Z = BACK_WALL_GOAL_POSITION.z + LEFT_RIGHT_WALL_GOAL_SIZE.height;

var BALL_OUT_Y = BACK_WALL_GOAL_POSITION.y + 3;

var BUFFER_ANIM_PLAYER = FPS;

var MS_EFFECT_ADD = 1500;

var MS_ROLLING_SCORE = 500;

var MAX_PERCENT_PROBABILITY = 100;

var GOAL_KEEPER_TOLLERANCE_LEFT = -4;
var GOAL_KEEPER_TOLLERANCE_RIGHT = 4;

var TIME_RESET_AFTER_BALL_OUT = 250;

var TIME_RESET_AFTER_SAVE = 500;

var AREA_GOAL_PROPERTIES = {width: 4, depth: 1, height: 2.4};

var FIRST_AREA_GOAL_POS = {x: -14 - (AREA_GOAL_PROPERTIES.width * 0.5),
    y: BACK_WALL_GOAL_POSITION.y - UP_WALL_GOAL_SIZE.depth + 1.1,
    z: 3.1 - (AREA_GOAL_PROPERTIES.height * 0.5)};

var GOAL_KEEPER_DEPTH_Y = BACK_WALL_GOAL_POSITION.y - UP_WALL_GOAL_SIZE.depth;

var POLE_UP_SIZE = {radius_top: 0.5, radius_bottom: 0.5, height: 40.5, segments: 10};

var POLE_RIGHT_LEFT_SIZE = {radius_top: 0.5, radius_bottom: 0.5, height: 15, segments: 10};

var COLOR_AREA_GOAL = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xf0f0f0, 0x0f0f0f,
    0xffbb99, 0xffffff, 0x569910, 0x99dd22, 0x102080, 0x801020, 0x899869];//15

var OFFSET_FIELD_Y = 35;
var OFFSET_FIELD_X = 35;

var HIT_BALL_MAX_FORCE = 130;
var HIT_BALL_MIN_FORCE = 5;

var FORCE_RATE = 0.0014;

var SHOW_AREAS_GOAL = false;

var FORCE_MULTIPLIER_AXIS = {x: 0.12, y: 0.4, z: 0.08};

var FORCE_MAX = 0.5;

var FIELD_POSITION;

var MAX_FORCE_Y = 66;

var MIN_FORCE_Y = 50;

var CALCULATE_PROBABILITY = [{xMax: -7, xMin: -11, zMax: 11, zMin: 8}, {xMax: -3.6, xMin: -7, zMax: 11, zMin: 8},
    {xMax: 3.6, xMin: -3.6, zMax: 11, zMin: 8}, {xMax: 7, xMin: 3.6, zMax: 11, zMin: 8}, {xMax: 11, xMin: 7, zMax: 11, zMin: 8},
    {xMax: -7, xMin: -7, zMax: 8, zMin: 5}, {xMax: -3.6, xMin: -7, zMax: 8, zMin: 5},
    {xMax: 3.6, xMin: -3.6, zMax: 8, zMin: 5}, {xMax: 7, xMin: 3.6, zMax: 8, zMin: 5}, {xMax: 11, xMin: 7, zMax: 8, zMin: 5},
    {xMax: -7, xMin: -11, zMax: 5, zMin: 0}, {xMax: -3.6, xMin: -7, zMax: 5, zMin: 0},
    {xMax: 3.6, xMin: -3.6, zMax: 5, zMin: 0}, {xMax: 7, xMin: 3.6, zMax: 5, zMin: 0}, {xMax: 11, xMin: 7, zMax: 5, zMin: 0}];

var SHOW_3D_RENDER = false;

var CAMERA_TEST_TRACKBALL = false;

var CAMERA_TEST_TRANSFORM = false;

var CANVAS_3D_OPACITY = 0.5;

var MOUSE_SENSIBILTY = 0.03;

var CAMERA_TEST_LOOK_AT = {x: 0, y: -500, z: -100};

var BALL_SCALE_FACTOR = 0.07;
var SHADOWN_FACTOR = 1.1;

var INTENSITY_DISPLAY_SHOCK = [{x: 10, y: 7.5, time: 50}, {x: 20, y: 9, time: 50}, {x: 30, y: 12, time: 50}, {x: 33, y: 15, time: 50}];
var FORCE_BALL_DISPLAY_SHOCK = [{max: 55, min: MIN_FORCE_Y - 1}, {max: 58, min: 55}, {max: 62, min: 58}, {max: MAX_FORCE_Y, min: 62}];

var CAMERA_POSITION = {x: 0, y: 0, z: -7};

var FOV = 15;

var NEAR = 1, FAR = 2000;

var ENABLE_FULLSCREEN;
var ENABLE_CHECK_ORIENTATION;
var TIME_SWIPE;

var SOUNDTRACK_VOLUME_IN_GAME = 0.2;