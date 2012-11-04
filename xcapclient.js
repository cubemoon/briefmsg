
var xcapClient = function (){

	this.baseUrl = '';
	this.username = '';
	this.password = '';
	this.uri = '';

	this.isReady = false;
	this.hasResourceLists = false;
	this.hasRlsServices = false;
	this.hasPidfManipulation = false;
	this.isUpdating = false;
	this.contacts = [];
	this.pidfIndex = 0;

	//------------------------------------------------------------------------------------------

	this.initialize = function(server, uri, username, password) {

		this.uri = uri;
		this.baseUrl = this.getBaseUrl(server);
		this.username = username;
		this.password = password;

		DigestAuthentication.registerCredentials('briefmsg', 'pass');

		this.getXcapCaps();
	}

	this.getBaseUrl = function(server) {
		return 'http://' + server + '/xcap-root';
	}

	//------------------------------------------------------------------------------------------

	this.getXcapCaps = function() {

		this.ajaxXcap({
			url: '/xcap-caps/global/index',
			success: this.onGetXcapCaps
		});
	}

	this.onGetXcapCaps = function(xml) {

		this.isReady = true;
		
		var auids = xml.getElementsByTagName('auid');

		for(var i=0; i<auids.length; i++) {
			switch(auids[i].childNodes[0].nodeValue) {
				case 'resource-lists':
					this.hasResourceLists = true;
					break;
				case 'rls-services':
					this.hasRlsServices = true;
					break;
				case 'pidf-manipulation':
					this.hasPidfManipulation = true;
					break;
			}
		}
	}

	//------------------------------------------------------------------------------------------

	this.startUpdate = function(uri) {

		if(this.isReady == false){

			this.trigger({ type:'xcaperror' });
		}
		else {

			this.isUpdating = true;

			this.contacts = [];
			this.pidfIndex = 0;

			if(this.hasResourceLists)
				this.getResourceUsers();
		}
	}

	//------------------------------------------------------------------------------------------

	this.getResourceUsers = function() {

		this.ajaxXcap({
			url: '/resource-lists/users/' + this.uri + '/index',
			success: this.onGetResourceUsers
		});
	}

	this.onGetResourceUsers = function(xml) {

		this.processResourceUsers(xml);

		this.trigger({ type:'xcapdone', contacts:this.contacts });

		if(this.hasPidfManipulation)
			this.getPidf();
	}

	this.processResourceUsers = function(xml) {

		var entries = xml.getElementsByTagName('entry');
		for (var i = entries.length - 1; i >= 0; i--) {
			var entry = entries[i];
			var displayName = null;
			var uri = entry.getAttribute('uri');
			if(uri != null)
			{
				var displayNameNodes = entry.getElementsByTagName('display-name');
				if(displayNameNodes.length > 0)
					displayName = displayNameNodes[0].childNodes[0].nodeValue;
			}

			if(displayName == null)
				displayName = uri.substr(4);

			this.contacts.push(
				{ name: displayName, uri:uri });
		};
	}

	//------------------------------------------------------------------------------------------

	this.getPidf = function() {

		if(this.pidfIndex < this.contacts.length) {

			this.ajaxXcap({
				url: '/pidf-manipulation/users/' + this.contacts[this.pidfIndex].uri + '/index',
				success: this.onGetPidf,
				error: this.onGetPidfError,
				userParam: this.contacts[this.pidfIndex]
			});
		}
	}

	this.onGetPidf = function(xml, param) {

		param.status = null;

		var notes = xml.getElementsByTagName('note');

		for(var i=0; i<notes.length; i++) {
			var note = notes[i].childNodes[0].nodeValue.toLowerCase();
			switch(note) {
			case 'online':
			case 'away':
			case 'busy':
			case 'offline':
				param.status = note;
				break;
			case 'dnd':
				param.status = 'busy';
				break;
			default:
				if(note.indexOf('busy') >= 0)
					param.status = 'busy';
				else
					console.log('[ XCAP ] Unknow note value:', note);
				break;
			}
		}

		if(param.status == null) {

			var basics = xml.getElementsByTagName('basic');

			for(var i=0; i<basics.length; i++) {
				if(basics[i].childNodes[0].nodeValue === 'open') {
					param.status = 'online';
					break;
				}
			}
		}

		if(param.status == null)
			param.status = 'offline';

		this.trigger({ type:'xcapupdatecontact', contact: param });

		this.getNextPidf();
	}

	this.onGetPidfError = function(jqXHR) {

		if(jqXHR.status == 404) {

			this.getNextPidf();
		}
		else {

			this.onGeneralError(jqXHR);
		}
	}

	this.getNextPidf = function() {

		this.pidfIndex++;
		this.getPidf();
	}

	//------------------------------------------------------------------------------------------

	this.ajaxXcap = function(settings) {

		var self = this;

		$.ajax({
			type: 'GET',
			url: this.baseUrl + settings.url,
			dataType: 'xml',
		//	username: this.username,
		//	password: this.password,
			crossDomain: true,
			context: this,
			success: (typeof settings.userParam === 'undefined') ? settings.success 
				: function(jqXHR) { settings.success.call(self, jqXHR, settings.userParam); },
			error: (typeof settings.error !== 'undefined') ? settings.error : this.onGeneralError
		});
	}

	//------------------------------------------------------------------------------------------

	this.finished = function() {

		this.isUpdating = false;

		this.trigger({ type:'xcapdone', contacts:this.contacts });
	}

	this.onGeneralError = function(xhr) {

		this.isUpdating = false;
		this.trigger({ type:'xcaperror' });
	}

	//------------------------------------------------------------------------------------------

	this.handlers = [];
	
	this.onAny = function(handler) {
		this.handlers.push(handler);
	};

	this.trigger = function(event){
		for (var i=0; i<this.handlers.length; i++)
			this.handlers[i](event);
	};

	//------------------------------------------------------------------------------------------
}