'use strict';

const gulp = require('gulp');
const uglify = require('gulp-uglify');
const minifycss = require('gulp-minify-css');
const htmlmin = require('gulp-htmlmin');
const htmlclean = require('gulp-htmlclean');
const imagemin = require('gulp-imagemin');

gulp.task('minify-css', () => {
	return gulp.src('./public/**/*.css')
		.pipe(minifycss())
		.pipe(gulp.dest('./public'));
});

gulp.task('minify-html', () => {
	return gulp.src('./public/**/*.html')
		.pipe(htmlclean())
		.pipe(htmlmin({
			removeComments: true,
			minifyJS: true,
			minifyCss: true,
			minifyURLs: true
		}))
		.pipe(gulp.dest('./public'));
});

gulp.task('minify-js', () => {
	return gulp.src('./public/**/*.js')
		.pipe(uglify())
		.pipe(gulp.dest('./public'));
});

gulp.task('default', [
	'minify-html', 'minify-css', 'minify-js'
]);