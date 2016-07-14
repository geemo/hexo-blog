(function() {
    var short_name = 'geemo';
    var threads = [];
    var thread_id;
    var i, len;

    var articles = document.getElementsByTagName('article');
    for (i = 0, len = articles.length; i < len; ++i) {
        thread_id = articles[i].id;
        if (thread_id && /^post-.+$/.test(thread_id))
            threads.push(thread_id.match(/post-(.+)/)[1]);
    }

    if (threads.length) {
        $.getJSON('https://api.duoshuo.com/threads/counts.jsonp?short_name=' 
        	+ short_name + '&threads=' + threads.join(',') + '&callback=?', setCommentCount);
    }

    function setCommentCount(data) {
    	var res = data.response;
    	var btn = null;
    	var comments = 0;
    	if(data.code === 0){
    		for(i = 0; i < len; ++i){
    			btn = articles[i].querySelector('.article-more-link > a');
    			comments = res[threads[i]]['comments'];
    			btn.innerHTML = comments ? (comments + '条评论>>') : '更多评论>>';
    		} 
    	}
    }

})();
