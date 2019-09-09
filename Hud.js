
//	we should make this as close to Pop.Gui as possible really... and re-use it for web
//	but for now, lets just mess with the DOM
Pop.Hud = {};

Pop.Hud.Slider = Pop.Gui.Slider;

Pop.Hud.Label = function()
{
	Pop.Gui.Label.apply( this, arguments );

	this.VisibleCache = null;
	
	this.SetVisible = function(Visible)
	{
		if ( !this.Element )
			return;
		
		//	avoid style changes
		if ( this.VisibleCache === Visible )
			return;
		
		//	initial overwrites css, we want to switch back to css :/
		//this.Element.style.display = Visible ? 'initial' : 'none';
		this.Element.style.visibility = Visible ? 'inherit' : 'hidden';
		this.VisibleCache = Visible;
	}
}

//	reference to a button
Pop.Hud.Button = function()
{
	Pop.Gui.Button.apply( this, arguments );
	
	this.VisibleCache = null;
	
	this.SetVisible = function(Visible)
	{
		if ( !this.Element )
			return;
		
		//	avoid style changes
		if ( this.VisibleCache === Visible )
			return;
		
		//	initial overwrites css, we want to switch back to css :/
		//this.Element.style.display = Visible ? 'initial' : 'none';
		this.Element.style.visibility = Visible ? 'inherit' : 'hidden';
		this.VisibleCache = Visible;
	}
}


if ( Pop.GetPlatform() != 'Web' )
{
	function StubHudControl()
	{
		this.SetVisible = function(){};
		this.SetValue = function(){};
		this.SetMinMax = function(){};
	}
	
	Pop.Hud.Slider = StubHudControl;
	Pop.Hud.Button = StubHudControl;
	Pop.Hud.Label = StubHudControl;
}

