var gulp = require('gulp');

var sass = require('gulp-sass');

var minify = require('gulp-minify-css');
var concat = require('gulp-concat');
var prefix = require('gulp-autoprefixer');
var watch = require('gulp-watch');
var gutil = require('gulp-util');
var del = require('del');
var uglify = require('gulp-uglify');
var notifier = require('node-notifier');

function swallowError (error) {

    console.log(error.toString());
    gutil.beep();
    notifier.notify({
        title: 'Gulp Error',
        message: 'Error while compiling Scss'
    });
    this.emit('end');
}

gulp.task('scss', function() {

    del(['assets/css']);

    return gulp.src('assets/scss/**/*.scss')
        .pipe(sass())
        .on('error', swallowError)
        .pipe(prefix("last 3 versions", "> 1%", "ie 8", "ie 9"))
        .on('error', gutil.log)
        .pipe(gulp.dest('assets/css'));
});

gulp.task('css', ['scss'], function() {
    return gulp.src('assets/css/**/*.css')
        .pipe(concat('all.min.css'))
        .pipe(minify())
        .on('error', gutil.log)
        .pipe(gulp.dest('assets/dist'));
});

gulp.task('js', function() {
    return gulp.src('assets/js/**/*.js')
        .pipe(concat('all.min.js'))
        // .pipe(uglify())
        .on('error', gutil.log)
        .pipe(gulp.dest('assets/dist'));
});

gulp.task('watch_css', function() {
    watch({glob: 'assets/scss/**/*'}, function() {
        gulp.start('css');
    });
});

gulp.task('watch_js', function() {
    watch({glob: 'assets/js/**/*'}, function() {
        gulp.start('js');
    });
});

// Default Task
gulp.task('default', ['css', 'js', 'watch_css', 'watch_js']);