var templateStr =
  '{{#items}}' +
  '<a href="http://facebook.com/{{ id }}" target="_blank">' +
  '<div class="fb-entry">'+
  '  <div class="fb-entry__title">{{ description }}</div>'+
  '  <div class="fb-entry__description">' +
  '    <div class="fb-entry__group">{{ groupName }}</div>' +
  '    <div class="fb-entry__stats">' +
  '    {{#likes}} <span style="margin-right: 3px;"><i class="icon-thumbs-up"></i>{{likes}}</span> {{/likes}}' +
  '    {{#comments}} <span style="margin-right: 3px;"><i class="icon-comment-empty"></i>{{comments}}</span> {{/comments}}' +
  '    {{#timeAgo}} <span style="margin-right: 3px;"><i class="icon-clock"></i>{{timeAgo}}</span> {{/timeAgo}}' +
  '    </div>' +
  '  </div>' +
  '</div>' +
  '</a>'+
  '{{/items}}'
;


function start() {

  if(window.feeds[0] && window.feeds[0].timeAgo) {
    document.getElementById('latest-update').innerHTML = window.feeds[0].timeAgo;
  }


  var html = Mustache.render(templateStr, {items: window.feeds || []});
  document.getElementById('feeds').innerHTML = html;

}

start();


