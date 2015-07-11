var time_took = Array();
var timers = new Object();

function time_start(timer_name){
	timers[timer_name] = new Date().getTime();
}

function time_end(timer_name, quiet_mode){
	var end_time = new Date().getTime();
	var time_took = end_time - timers[timer_name];

	if(quiet_mode){
		return time_took;
	}

	console.log( timer_name + ' ' + time_took + 'ms' );
}

function time(timer_name){

	if( typeof(timers[timer_name]) == 'undefined' ){
		time_start(timer_name);
	} else {
		time_end(timer_name);
	}

}

function cl(input){
	console.log(input);
}

function rough_size_of_object( object ) {

	var objectList = [];
	var stack = [ object ];
	var bytes = 0;

	while ( stack.length ) {
		var value = stack.pop();

		if ( typeof value === 'boolean' ) {
			bytes += 4;
		}
		else if ( typeof value === 'string' ) {
			bytes += value.length * 2;
		}
		else if ( typeof value === 'number' ) {
			bytes += 8;
		}
		else if
		(
			typeof value === 'object'
			&& objectList.indexOf( value ) === -1
		)
		{
			objectList.push( value );

			for( var i in value ) {
				stack.push( value[ i ] );
			}
		}
	}
	return bytes;
}