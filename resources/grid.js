var heatmap;

S().ready(function(){

	function receiveMessage(event) {
		console.log('Received message from '+event.origin);
		if(event.origin !== "https://odileeds.github.io") return;

		S('#drop_zone').append('<div><strong>Received data from '+event.data.referer+'</strong> - ' + niceSize(event.data.csv.length) + '</div>').addClass('loaded');
		//S('.step1').addClass('checked');
		//S('.step2').addClass('checked');
		heatmap.loadData(event.data.csv);

		return;
	}

	window.addEventListener("message", receiveMessage, false);

	function dropOver(evt){
		evt.stopPropagation();
		evt.preventDefault();
		S(this).addClass('drop');
	}
	function dragOff(){
		S(this).removeClass('drop');
	}

	function Heatmap(inp){

		// Extra mathematical/helper functions that will be useful - inspired by http://alexyoung.github.com/ico/
		var G = {};
		G.sum = function(a) { var i, sum; for (i = 0, sum = 0; i < a.length; sum += a[i++]) {}; return sum; };
		if (typeof Array.prototype.max === 'undefined') G.max = function(a) { return Math.max.apply({}, a); };
		else G.max = function(a) { return a.max(); };
		if (typeof Array.prototype.min === 'undefined') G.min = function(a) { return Math.min.apply({}, a); };
		else G.min = function(a) { return a.min(); };
		G.mean = function(a) { return G.sum(a) / a.length; };

		// Setup the dnd listeners.
		var dropZone = document.getElementById('drop_zone');
		dropZone.addEventListener('dragover', dropOver, false);
		dropZone.addEventListener('dragout', dragOff, false);

		var _obj = this;
		document.getElementById('standard_files').addEventListener('change',function(evt){
			evt.stopPropagation();
			evt.preventDefault();
			console.log('change')
			return _obj.handleFileSelect(evt,'json');
		}, false);

		var mapel = S('#contents');

		this.lat = 53.7978
		this.lon = -1.5460;
		this.zoom = 11;

		var mapid = mapel.attr('id');
		this.map = L.map(mapid,{'scrollWheelZoom':true});
		var _obj = this;
		
		// Add events
		S('#save').on('click',{me:this},function(e){
			e.data.me.save();
		});
		S('#gridsize').on('change',{me:this},function(e){
			if(e.data.me.data) e.data.me.makeMap();
		});



		this.map.setView([this.lat, this.lon], this.zoom);
		var icon = L.Icon.extend({
			options: {
				shadowUrl: '../../../resources/images/marker-shadow.png',
				iconSize:     [25, 41], // size of the icon
				shadowSize:   [41, 41], // size of the shadow
				iconAnchor:   [12.5, 41], // point of the icon which will correspond to marker's location
				shadowAnchor: [12.5, 41],  // the same for the shadow
				popupAnchor:  [0, -41] // point from which the popup should open relative to the iconAnchor
			}
		});

		var scales = {
			'ODI': '#2254F4 0%, rgb(230,0,124) 50%, rgb(249,188,38) 100%',
			'Heat': 'rgb(0,0,0) 0%, rgb(128,0,0) 25%, rgb(255,128,0) 50%, rgb(255,255,128) 75%, rgb(255,255,255) 100%',
			'Planck': 'rgb(0,0,255) 0, rgb(0,112,255) 16.666%, rgb(0,221,255) 33.3333%, rgb(255,237,217) 50%, rgb(255,180,0) 66.666%, rgb(255,75,0) 100%',
			'Viridis8': 'rgb(122,76,139) 0, rgb(124,109,168) 12.5%, rgb(115,138,177) 25%, rgb(107,164,178) 37.5%, rgb(104,188,170) 50%, rgb(133,211,146) 62.5%, rgb(189,229,97) 75%, rgb(254,240,65) 87.5%',
			'Plasma': 'rgb(12,7,134) 0, rgb(82,1,163) 12.5%, rgb(137,8,165) 25%, rgb(184,50,137) 37.5%, rgb(218,90,104) 50%, rgb(243,135,72) 62.5%, rgb(253,187,43) 75%, rgb(239,248,33) 87.5%',
			'Population': 'rgb(232,173,170) -1000, rgb(232, 173, 170) 0, rgb(255,â€‹243,128) 0, rgb(135,247,23) 4, rgb(76,196,23) 11, rgb(52,128,23) 50',
			'Referendum': '#4BACC6 0, #B6DDE8 50%, #FFF380 50%, #FFFF00 100%',
		}
		/*
		L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
			attribution: 'Tiles: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>. Data: <a href="http://openstreetmap.org">OpenStreetMap</a> (ODbL); <a href="https://odileeds.org/">ODI Leeds</a>; <a href="http://thingsmanchester.org.uk/">Things Manchester</a>',
			subdomains: 'abcd',
			maxZoom: 19
		}).addTo(this.map);
		*/
		L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png', {
			attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
			subdomains: 'abcd',
			maxZoom: 19
		}).addTo(this.map);

		this.map.attributionControl.setPrefix('');

		// Define colour routines
		function Colour(c,n){
			if(!c) return {};

			function d2h(d) { return ((d < 16) ? "0" : "")+d.toString(16);}
			function h2d(h) {return parseInt(h,16);}
			/**
			 * Converts an RGB color value to HSV. Conversion formula
			 * adapted from http://en.wikipedia.org/wiki/HSV_color_space.
			 * Assumes r, g, and b are contained in the set [0, 255] and
			 * returns h, s, and v in the set [0, 1].
			 *
			 * @param   Number  r       The red color value
			 * @param   Number  g       The green color value
			 * @param   Number  b       The blue color value
			 * @return  Array           The HSV representation
			 */
			function rgb2hsv(r, g, b){
				r = r/255, g = g/255, b = b/255;
				var max = Math.max(r, g, b), min = Math.min(r, g, b);
				var h, s, v = max;
				var d = max - min;
				s = max == 0 ? 0 : d / max;
				if(max == min) h = 0; // achromatic
				else{
					switch(max){
						case r: h = (g - b) / d + (g < b ? 6 : 0); break;
						case g: h = (b - r) / d + 2; break;
						case b: h = (r - g) / d + 4; break;
					}
					h /= 6;
				}
				return [h, s, v];
			}

			this.alpha = 1;

			// Let's deal with a variety of input
			if(c.indexOf('#')==0){
				this.hex = c;
				this.rgb = [h2d(c.substring(1,3)),h2d(c.substring(3,5)),h2d(c.substring(5,7))];
			}else if(c.indexOf('rgb')==0){
				var bits = c.match(/[0-9\.]+/g);
				if(bits.length == 4) this.alpha = parseFloat(bits[3]);
				this.rgb = [parseInt(bits[0]),parseInt(bits[1]),parseInt(bits[2])];
				this.hex = "#"+d2h(this.rgb[0])+d2h(this.rgb[1])+d2h(this.rgb[2]);
			}else return {};
			this.hsv = rgb2hsv(this.rgb[0],this.rgb[1],this.rgb[2]);
			this.name = (n || "Name");
			var r,sat;
			for(r = 0, sat = 0; r < this.rgb.length ; r++){
				if(this.rgb[r] > 200) sat++;
			}
			this.text = (this.rgb[0] + this.rgb[1] + this.rgb[2] > 500 || sat > 1) ? "black" : "white";
			return this;
		}

		/*
		var info = L.control();
		info.onAdd = function(map){
			this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
			this.update();
			return this._div;
		}
		// method that we will use to update the control based on feature properties passed
		info.update = function(props){
			this._div.innerHTML = '<ul class="key"><li><span class="c13-bg"></span> Internal gateway</li><li><span class="c14-bg"></span> External gateway</li></ul><h4>Signal-to-noise (time-weighted mean)</h4>' +  (props ?
				'' + props.snr.toFixed(1) + ' dB' + ' ('+props.n+' reading'+(props.n==1 ? '':'s')+')'
				: 'Hover over a cell');
		};
		info.addTo(this.map);
		*/

		this.handleFileSelect = function(evt,typ){

			dragOff();

			var files;
			if(evt.dataTransfer && evt.dataTransfer.files) files = evt.dataTransfer.files; // FileList object.
			if(!files && evt.target && evt.target.files) files = evt.target.files;

			if(typ == "json"){

				// files is a FileList of File objects. List some properties.
				var output = "";
				for (var i = 0, f; i < files.length; i++) {
					f = files[i];

					this.file = f.name;
					// ('+ (f.type || 'n/a')+ ')
					output += '<div><strong>'+ (f.name)+ '</strong> - ' + niceSize(f.size) + ', last modified: ' + (f.lastModifiedDate ? f.lastModifiedDate.toLocaleDateString() : 'n/a') + '</div>';

					// DEPRECATED as not reliable // Only process csv files.
					//if(!f.type.match('text/csv')) continue;

					var start = 0;
					var stop = f.size - 1; //Math.min(100000, f.size - 1);

					var reader = new FileReader();

					// Closure to capture the file information.
					reader.onloadend = function(evt) {
						if(evt.target.readyState == FileReader.DONE) { // DONE == 2
							if(stop > f.size - 1){
								var l = evt.target.result.regexLastIndexOf(/[\n\r]/);
								result = (l > 0) ? evt.target.result.slice(0,l) : evt.target.result;
							}else result = evt.target.result;

							// Render table
							heatmap.loadData(result,{'url':f.name});
						}
					};
					
					// Read in the image file as a data URL.
					//reader.readAsText(f);
					var blob = f.slice(start,stop+1);
					reader.readAsText(blob);
				}
				//document.getElementById('list').innerHTML = '<p>File loaded:</p><ul>' + output.join('') + '</ul>';
				S('#drop_zone').append(output).addClass('loaded');
			//	S('.step1').addClass('checked');
			//	S('.step2').addClass('checked');
			}
			return this;
		}

		this.loadData = function(d){
		
			this.data = JSON.parse(d);
			// Need to find range of map
			this.range = {'lat':{'min':90,'max':-90},'lon':{'min':180,'max':-180}};
			for(i = 0; i < this.data.features.length; i++){
				c = this.data.features[i].geometry.coordinates
				if(c[0] < this.range.lon.min) this.range.lon.min = c[0];
				if(c[0] > this.range.lon.max) this.range.lon.max = c[0];
				if(c[1] < this.range.lat.min) this.range.lat.min = c[1];
				if(c[1] > this.range.lat.max) this.range.lat.max = c[1];
			}
			console.log(this.range);


			this.makeMap();
		}

		function round(v,prec){
		
			if(prec){ v /= prec; }
			v = Math.floor(v + v/Math.abs(v*2 || 1));
			if(prec){ v *= prec; }
			return v;
		}

		this.makeMap = function(){
						
			console.log('makeMap',this.data);
			
			if(this.heat) this.map.removeLayer(this.heat);
			
			this.gridsize = S('#gridsize')[0].value;
			
			// Approximate conversion from degrees of latitude to metres
			// Assumes a spherical Earth which is probably good enough for these purposes.
			// 2*PI*R = circumference of the Earth (approx because it isn't spherical)
			circ = 6371000 * 2 * Math.PI;
			d2r = Math.PI / 180;


			n = this.data.features.length;

			// Latitude bins are constant spacing in degrees/radians/metres
			// Longitude bins need to vary in size due to the fact that
			// angles take up less physical space as we go to higher latitudes

			var grid,dlons;

			// Latitude spacing in degrees
			var dlat = parseFloat(((this.gridsize/circ)*360).toFixed(6));
			var dlons = {};
			var grid = {};
			
			cenlat = 53.79589;
			cenlon = -1.73893;
			radius = 1.5;
			
			for(var i = 0; i < n; i++){

				// Get lat and lon values
				lon = this.data.features[i].geometry.coordinates[0];
				lat = this.data.features[i].geometry.coordinates[1];
				
				if(typeof lat==="number" && typeof lon==="number"){
					lat = parseFloat(round(lat,dlat).toFixed(6));
						
					// See if we've worked out the longitude bin size for this latitude bin
					if(!dlons[lat]) dlons[lat] = parseFloat((dlat / Math.cos(lat * d2r)).toFixed(6));

					dlon = dlons[lat];
					lon = parseFloat(round(lon,dlon).toFixed(6));

					if(!grid[lat]){ grid[lat] = {}; }
					if(!grid[lat][lon]){
						grid[lat][lon] = {'n':0,'dlat':dlat,'dlon':dlon};
					}
					grid[lat][lon].n++;
				}
			}

			this.mx = -1e100;
			this.mn = 1e100;

			// Make heatmap
			i = 0;
			var geojson = "";
			for(lat in grid){
				for(lon in grid[lat]){
					dlon = grid[lat][lon].dlon/2;
					dlat = grid[lat][lon].dlat/2;
					if(grid[lat][lon].n > this.mx) this.mx = grid[lat][lon].n;
					if(grid[lat][lon].n < this.mn) this.mn = grid[lat][lon].n;
					lo = parseFloat(lon);
					la = parseFloat(lat);
					if(geojson) geojson += ',\n';
					geojson += '{"type":"Feature","id":'+i+',"properties":{"rows":'+grid[lat][lon].n+'},"geometry":{"type":"Polygon","coordinates":[[['+(lo - dlon).toFixed(5)+','+(la - dlat).toFixed(5)+'],['+(lo - dlon).toFixed(5)+','+(la + dlat).toFixed(5)+'],['+(lo + dlon).toFixed(5)+','+(la + dlat).toFixed(5)+'],['+(lo + dlon).toFixed(5)+','+(la - dlat).toFixed(5)+']]]}}';
				}
			}
			geojson = '{ "type": "FeatureCollection","features":['+geojson+'] }';



			function extractColours(c,mn,mx){
				var stops = c.replace(/^\s+/g,"").replace(/\s+$/g,"").replace(/\s\s/g," ").split(', ');
				var cs = new Array();
				for(var i = 0; i < stops.length; i++){
					var bits = stops[i].split(/ /);
					if(bits.length==2) cs.push({'v':bits[1],'c':new Colour(bits[0])})
					else if(bits.length==1) cs.push({'c':new Colour(bits[0])});
				}
				var r = mx-mn;
				for(var c=0; c < cs.length;c++){
					// If a colour-stop has a percentage value provided, 
					if(cs[c].v && cs[c].v.indexOf('%')>0) cs[c].v = (mn + parseFloat(cs[c].v)*r/100);
				}
				if(!cs[0].v) cs[0].v = mn; // Set the minimum value
				if(!cs[cs.length-1].v) cs[cs.length-1].v = mx; // Set the maximum value
				var skip = 0;
				// If a colour-stop doesn't have a specified position and it isn't the first
				// or last stop, then it is assigned the position that is half way between
				// the previous stop and next stop
				for(var c=1; c < cs.length;c++){
					// If we haven't got a value we increment our counter and move on
					if(!cs[c].v) skip++;
					// If we have a value and the counter shows we've skipped some
					// we now back-track and set them.
					if(cs[c].v && skip > 0){
						for(var d = 1; d <= skip ; d++){
							a = cs[c-skip-1].v;
							b = cs[c].v;
							cs[c-d].v = a + (b-a)*(skip-d+1)/(skip+1);
						}
						todo = 0;
					}
				}
				return cs;
			}
			function getColour(v,min,max){

				if(colourscale.length == 1) var colour = 'rgba('+colourscale[0].c.rgb[0]+', '+colourscale[0].c.rgb[1]+', '+colourscale[0].c.rgb[2]+', ' + v / max + ")";
				else{
					var colour = "";
					for(var c = 0; c < colourscale.length-1; c++){
						if(v >= colourscale[c].v){
							var pc = (v - colourscale[c].v)/(colourscale[c+1].v-colourscale[c].v);
							var a = colourscale[c].c;
							var b = colourscale[c+1].c;
							if(v > max) pc = 1;	// Don't go above colour range
							colour = 'rgb('+parseInt(a.rgb[0] + (b.rgb[0]-a.rgb[0])*pc)+','+parseInt(a.rgb[1] + (b.rgb[1]-a.rgb[1])*pc)+','+parseInt(a.rgb[2] + (b.rgb[2]-a.rgb[2])*pc)+')';
							continue;
						}
					}
				}
				return colour;
			}
			var _obj = this;
			function style(feature) {
				var c = getColour(feature.properties.rows,_obj.mn,_obj.mx);
				return {
					fillColor: c,
					stroke: 0,
					weight: 2,
					color: c,
					opacity: 0.7,
					fillOpacity: 0.6
				};
			}

			var colourscale = extractColours(scales['Viridis8'],this.mn,this.mx);

			function highlightFeature(e){
				var layer = e.target;
				console.log(layer.feature.properties);
			}
			function resetHighlight(e){
				//info.update();
			}
			function onEachFeature(feature, layer){
				layer.on({
					mouseover: highlightFeature,
					mouseout: resetHighlight
				});
			}

			this.heat = L.geoJson(JSON.parse(geojson),{style:style,onEachFeature: onEachFeature}).addTo(this.map);
			
			S('#geojson textarea').html(geojson)

			return this;
		}


		this.save = function(){

			// Bail out if there is no Blob function
			if(typeof Blob!=="function") return this;

			var textFileAsBlob = new Blob([this.geojson], {type:'text/plain'});
			if(!this.file) this.file = "schema.json";
			var fileNameToSaveAs = this.file.substring(0,this.file.lastIndexOf("."))+"-heatmap.geojson";

			function destroyClickedElement(event){ document.body.removeChild(event.target); }

			var dl = document.createElement("a");
			dl.download = fileNameToSaveAs;
			dl.innerHTML = "Download File";
			if(window.webkitURL != null){
				// Chrome allows the link to be clicked
				// without actually adding it to the DOM.
				dl.href = window.webkitURL.createObjectURL(textFileAsBlob);
			}else{
				// Firefox requires the link to be added to the DOM
				// before it can be clicked.
				dl.href = window.URL.createObjectURL(textFileAsBlob);
				dl.onclick = destroyClickedElement;
				dl.style.display = "none";
				document.body.appendChild(dl);
			}
			dl.click();
			S('.step3').addClass('checked');

			return this;
		}
		return this;
	}

	function niceSize(b){
		if(b > 1e12) return (b/1e12).toFixed(2)+" TB";
		if(b > 1e9) return (b/1e9).toFixed(2)+" GB";
		if(b > 1e6) return (b/1e6).toFixed(2)+" MB";
		if(b > 1e3) return (b/1e3).toFixed(2)+" kB";
		return (b)+" bytes";
	}




	heatmap = new Heatmap();

});

