var FastSimplexNoise = require('fast-simplex-noise');
var crypto = require('crypto');
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 9005 });

var Redis = require('redis');
var redis = Redis.createClient(6379, 'localhost');

redis.on("error", function(err) {
	console.error("Error connecting to redis", err);
});

redis.select(1);

// var world_seed = Math.random();
function random(){
	// return world_seed;
	return 0.4710536374424983;
}

var fast_simplex = new FastSimplexNoise({random: random});
fast_simplex.octaves = 12;
fast_simplex.frequency = 0.315;
fast_simplex.persistence = 0.5;

var map_size = 100;

var authenticated_users = Object();

wss.on('connection', function connection(ws) {

	ws.on('message', function incoming(message) {

		try {
			var parsed_message = JSON.parse(message);
			var message_type = parsed_message.type;
		} catch(err) {
			console.log('Invalid client request json');
			console.log(err);
			return false;
		}

		switch (message_type){
			case 'get_map_data':
				// console.time('generate map');
				var tilemaps = new Object();
				var origin_points = parsed_message.map_params.origin_points;

				for(var i in origin_points){
					var origin_point = parsed_message.map_params.origin_points[i];
					var tmp_x = Math.floor( origin_point / map_size);
					var tmp_y = origin_point - (tmp_x * map_size);

					parsed_message.map_params.origin = [tmp_x, tmp_y];
					tilemaps[origin_point] = generate_tilemap(parsed_message.map_params);
				}

				ws.send( get_json( {type:'map_data', tilemaps: tilemaps, origin_points:origin_points} ) );
				// console.timeEnd('generate map');
				break;


			case 'get_building_data':
				get_buildings( parsed_message.params, function(ret){

					ws.send( get_json( {type:'building_data', building_map: ret} ) );

				});
				break;

			case 'clear_building_data':
				redis.select(3);
				redis.flushdb();
				break;

			case 'login':
				// Do actual username password check
				var user_id = 123;
				var tmp_hash = crypto.createHash('md5').digest('hex');
				authenticated_users[tmp_hash] = user_id;
				ws.send( get_json({type:'login', auth_token: tmp_hash}) );
				break;

			case 'authenticate':
				if( typeof( authenticated_users[parsed_message.auth_token]) == 'number' ){
					var success = true;
				} else {
					var success = false;
				}
				ws.send( get_json({type:'authenticate', success: success}) );
				break;

			case 'user_info':
				if( typeof( authenticated_users[parsed_message.auth_token]) == 'number' ){

					redis.select(1);
					redis.get( authenticated_users[parsed_message.auth_token], function(err, results){

						if( results === null){
							ws.send( get_json({type:'new_user'}) );
						} else {
							ws.send( get_json({type:'user_info', user_info: JSON.parse(results)}) );
						}

					});
				}
				break;

			case 'update_user_info':
				if( typeof( authenticated_users[parsed_message.auth_token]) == 'number' ){
					var user_id = authenticated_users[parsed_message.auth_token];
					console.log( parsed_message.user_info );

					redis.select(1);
					redis.set(user_id, get_json(parsed_message.user_info) );
				}

				break;

			case 'world_map_data':
				console.time('g');
				var world_tilemap = generate_tilemap( {map_size: parsed_message.map_size, cube_size: parsed_message.cube_size, origin: parsed_message.origin} );
				console.timeEnd('g');
				ws.send( get_json( {type:'world_map_data', world_tilemap: world_tilemap} ));
				break;

			case 'make_building':
				var tmp_x = parsed_message.coords[0];
				var tmp_y = parsed_message.coords[1];
				var building_type = parsed_message.building_type;

				var tmp_coord = (tmp_x * map_size) + tmp_y;
				tmp_coord = pad( tmp_coord, 13 );

				redis.select(3);
				redis.set( tmp_coord, get_json({building: building_type}) );

				break;

			default:
				console.log('Unkown client request. Unknown Type.');
				console.log(parsed_message);
				break;

		}

		// console.log('received: %s', message);

	});

	// console.log( wss.clients.length );

	// console.log('sending');
	// ws.send( JSON.stringify( ['clients:'+wss.clients.length] ) );
});

	function get_json(input){
		try {
			var json_string = JSON.stringify(input);
		} catch(err) {
			console.log('Invalid Json');
			console.log(err);
			return false;
		}

		return json_string;
	}

	function pad(num, size) {
		var s = "0000000000000" + num;
		return s.substr(s.length-size);
	}

	function generate_tilemap(map_params){

		if( typeof(map_params.cube_size) != 'undefined' ){
			var cube_size = parseInt(map_params.cube_size);
		} else {
			var cube_size = 10;
		}

		if( typeof(map_params.map_size) != 'undefined' ){
			map_size = parseInt(map_params.map_size);
		} else {
			map_size = 100;
		}

		// console.log( map_params );
		if( typeof(map_params.origin) != 'undefined' && map_params.origin.length ){
			var origin = map_params.origin;
		} else {
			var origin = [0,0];
		}

		// if(cube_size > 800){
		// 	return false;
		// }

		var tilemap = {
			ocean: { tiles: Array(), color: '#254e78'},
			coastline: { tiles: Array(), color: '#326800' },
			inland: { tiles: Array(), color: '#4C7124'},
			highland: { tiles: Array(), color: '#59842A'},
			mountain: { tiles: Array(), color: '#7A8781'}
		}

		var start_x = parseInt(origin[0], 10);
		var start_y = parseInt(origin[1], 10);

		var scale = cube_size / map_size;
		var local_x = 0;

		for(x = start_x; x < cube_size + start_x; x++){
			var local_y = 0;

			for(y = start_y; y < cube_size + start_y; y++){

				nx = Math.cos( ((x/cube_size) * scale) * 2 * Math.PI );
				ny = Math.cos( ((y/cube_size) * scale) * 2 * Math.PI );
				nz = Math.sin( ((x/cube_size) * scale) * 2 * Math.PI );
				nw = Math.sin( ((y/cube_size) * scale) * 2 * Math.PI );

				var tmp_elevation = fast_simplex.get4DNoise(nx,ny,nz,nw) + 0.55;

				if(tmp_elevation > 0 && tmp_elevation < 0.57){
					tilemap.ocean.tiles.push( {height: tmp_elevation, x: local_x, y: local_y} );
				} else if(tmp_elevation > 0.57 && tmp_elevation < 0.6 ){
					tilemap.coastline.tiles.push( {height: tmp_elevation, x: local_x, y: local_y} );
				} else if(tmp_elevation > 0.6 && tmp_elevation < 0.7 ){
					tilemap.inland.tiles.push( {height: tmp_elevation, x: local_x, y: local_y} );
				} else if(tmp_elevation > 0.7 && tmp_elevation < 0.8 ){
					tilemap.highland.tiles.push( {height: tmp_elevation, x: local_x, y: local_y} );
				} else if(tmp_elevation > 0.8 && tmp_elevation < 1 ){
					tilemap.mountain.tiles.push( {height: tmp_elevation, x: local_x, y: local_y} );
				}

				local_y++;
			}

			local_x++;
		}

		return tilemap;
	}

	function get_buildings(params, callback){

		// console.log(params);
		var tmp_origin = params.origin;

		var first_index = (tmp_origin[0] * map_size) + tmp_origin[1];
		var cube_size = params.cube_size;

		var range = [];
		var buildings;

		redis.select(3);

		for(var i = first_index; i < first_index + (cube_size*map_size); i += map_size ){
			for(var i2 = i; i2 < i + cube_size; i2++){
				range.push(i2);
			}
		}

		redis.mget(range, function(err, results){
			buildings = results;

			callback(buildings);
		});

	}

