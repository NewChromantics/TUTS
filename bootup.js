
Pop.Include = function(Filename)
{
	let Source = Pop.LoadFileAsString(Filename);
	return Pop.CompileAndRun( Source, Filename );
}

Pop.Include('PopEngineCommon/PopShaderCache.js');
Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
//Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');

const ParticleTrianglesVertShader = Pop.LoadFileAsString('ParticleTriangles.vert.glsl');
const QuadVertShader = Pop.LoadFileAsString('Quad.vert.glsl');
const ParticleColorShader = Pop.LoadFileAsString('ParticleColour.frag.glsl');
const BlitCopyShader = Pop.LoadFileAsString('BlitCopy.frag.glsl');
const ParticlePhysicsIteration_UpdateVelocity = Pop.LoadFileAsString('PhysicsIteration_UpdateVelocity.frag.glsl');
const ParticlePhysicsIteration_UpdatePosition = Pop.LoadFileAsString('PhysicsIteration_UpdatePosition.frag.glsl');

const NoiseTexture = new Pop.Image('Noise0.png');


function GenerateRandomVertexes(OnVertex)
{
	for ( let i=0;	i<10000;	i++ )
	{
		let x = Math.random() - 0.5;
		let y = Math.random() - 0.5;
		let z = Math.random() - 0.5;
		OnVertex(x,y,z);
	}
}

function LoadPlyGeometry(RenderTarget,Filename,WorldPositionImage,Scale,VertexSkip=0,GetIndexMap=null)
{
	let VertexSize = 2;
	let VertexData = [];
	let VertexDataCount = 0;
	let TriangleIndexes = [];
	let TriangleIndexCount = 0;
	let WorldPositions = [];
	let WorldPositionsCount = 0;
	let WorldPositionSize = 3;
	let WorldMin = [null,null,null];
	let WorldMax = [null,null,null];

	let PushIndex = function(Index)
	{
		TriangleIndexes.push(Index);
	}
	let PushVertexData = function(f)
	{
		VertexData.push(f);
	}
	let GetVertexDataLength = function()
	{
		return VertexData.length;
	}
	let PushWorldPos = function(x,y,z)
	{
		WorldPositions.push([x,y,z]);
	}
	

	//	replace data with arrays... no noticable speed improvement!
	let OnMeta = function(Meta)
	{
		/*
		VertexData = new Float32Array( Meta.VertexCount * 3 * VertexSize );
		PushVertexData = function(f)
		{
			VertexData[VertexDataCount] = f;
			VertexDataCount++;
		}
		GetVertexDataLength = function()
		{
			return VertexDataCount;
		}
		*/
		
		TriangleIndexes = new Int32Array( Meta.VertexCount * 3 );
		PushIndex = function(f)
		{
			TriangleIndexes[TriangleIndexCount] = f;
			TriangleIndexCount++;
		}
		/*
		WorldPositions = new Float32Array( Meta.VertexCount * 3 );
		PushWorldPos = function(x,y,z)
		{
			WorldPositions[WorldPositionsCount+0] = x;
			WorldPositions[WorldPositionsCount+1] = y;
			WorldPositions[WorldPositionsCount+2] = z;
			WorldPositionsCount += 3;
		}
		*/
	}
	OnMeta = undefined;

	let AddTriangle = function(TriangleIndex,x,y,z)
	{
		let FirstTriangleIndex = GetVertexDataLength() / VertexSize;
		
		let Verts;
		if ( VertexSize == 2 )
			Verts = [	0,TriangleIndex,	1,TriangleIndex,	2,TriangleIndex	];
		else if ( VertexSize == 4 )
			Verts = [	x,y,z,0,	x,y,z,1,	x,y,z,2	];
		Verts.forEach( v => PushVertexData(v) );
		
		PushIndex( FirstTriangleIndex+0 );
		PushIndex( FirstTriangleIndex+1 );
		PushIndex( FirstTriangleIndex+2 );
	}
	
	let TriangleCounter = 0;
	let VertexCounter = 0;
	let OnVertex = function(x,y,z)
	{
		if ( VertexCounter++ % (VertexSkip+1) > 0 )
			return;

		/*
		if ( TriangleCounter == 0 )
		{
			WorldMin = [x,y,z];
			WorldMax = [x,y,z];
		}
		*/
		AddTriangle( TriangleCounter,x,y,z );
		TriangleCounter++;
		PushWorldPos( x,y,z );
		/*
		WorldMin[0] = Math.min( WorldMin[0], x );
		WorldMin[1] = Math.min( WorldMin[1], y );
		WorldMin[2] = Math.min( WorldMin[2], z );
		WorldMax[0] = Math.max( WorldMax[0], x );
		WorldMax[1] = Math.max( WorldMax[1], y );
		WorldMax[2] = Math.max( WorldMax[2], z );
		*/
	}
	
	//let LoadTime = Pop.GetTimeNowMs();
	if ( Filename.endsWith('.ply') )
		Pop.ParsePlyFile(Filename,OnVertex,OnMeta);
	else if ( Filename.endsWith('.obj') )
		Pop.ParseObjFile(Filename,OnVertex,OnMeta);
	else if ( Filename.endsWith('.random') )
		GenerateRandomVertexes(OnVertex);
	else
		throw "Don't know how to load " + Filename;
	
	//Pop.Debug("Loading took", Pop.GetTimeNowMs()-LoadTime);
	
	if ( WorldPositionImage )
	{
		//	sort, but consistently
		if ( GetIndexMap )
		{
			let Map = GetIndexMap(WorldPositions);
			let NewPositions = [];
			Map.forEach( i => NewPositions.push(WorldPositions[i]) );
			WorldPositions = NewPositions;
		}
		
		let Unrolled = [];
		WorldPositions.forEach( xyz => {	Unrolled.push(xyz[0]);	Unrolled.push(xyz[1]);	Unrolled.push(xyz[2]);}	);
		WorldPositions = Unrolled;
		
		//let WorldPosTime = Pop.GetTimeNowMs();

		Scale = Scale||1;
		let Channels = 3;
		let Quantisise = false;
	
		let NormaliseCoordf = function(x,Index)
		{
			x *= Scale;
			return x;
		}
		
		const Width = 1024;
		const Height = Math.ceil( WorldPositions.length / WorldPositionSize / Width );
		let WorldPixels = new Float32Array( Channels * Width*Height );
		//WorldPositions.copyWithin( WorldPixels );
		
		let ModifyXyz = function(Index)
		{
			Index *= Channels;
			let x = WorldPixels[Index+0];
			let y = WorldPixels[Index+1];
			let z = WorldPixels[Index+2];
			//	normalize and turn into 0-255
			x = Quantisise ? Math.Range( WorldMin[0], WorldMax[0], x ) : x;
			y = Quantisise ? Math.Range( WorldMin[1], WorldMax[1], y ) : y;
			z = Quantisise ? Math.Range( WorldMin[2], WorldMax[2], z ) : z;
			x = NormaliseCoordf(x);
			y = NormaliseCoordf(y);
			z = NormaliseCoordf(z);
			//Pop.Debug(WorldMin,WorldMax,x,y,z);
			WorldPixels[Index+0] = x;
			WorldPixels[Index+1] = y;
			WorldPixels[Index+2] = z;
		}
	
		let PushPixel = function(xyz,Index)
		{
			WorldPixels[Index*Channels+0] = xyz[0];
			WorldPixels[Index*Channels+1] = xyz[1];
			WorldPixels[Index*Channels+2] = xyz[2];
			ModifyXyz( Index );
		}
		for ( let i=0;	i<WorldPositions.length;	i+=WorldPositionSize )
		{
			PushPixel( WorldPositions.slice(i,i+WorldPositionSize), i/WorldPositionSize );
		//	ModifyXyz( WorldPositions.slice(i,i+WorldPositionSize), i/WorldPositionSize );
		}
		
		//Pop.Debug("Making world positions took", Pop.GetTimeNowMs()-WorldPosTime);

		//let WriteTime = Pop.GetTimeNowMs();
		WorldPositionImage.WritePixels( Width, Height, WorldPixels, 'Float'+Channels );
		//Pop.Debug("Making world texture took", Pop.GetTimeNowMs()-WriteTime);
	}
	
	const VertexAttributeName = "Vertex";
	
	//	loads much faster as a typed array
	VertexData = new Float32Array( VertexData );
	TriangleIndexes = new Int32Array(TriangleIndexes);
	
	//let CreateBufferTime = Pop.GetTimeNowMs();
	let TriangleBuffer = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	//Pop.Debug("Making triangle buffer took", Pop.GetTimeNowMs()-CreateBufferTime);
	
	return TriangleBuffer;
}


//	todo: tie with render target!
let QuadGeometry = null;
function GetQuadGeometry(RenderTarget)
{
	if ( QuadGeometry )
		return QuadGeometry;

	let VertexSize = 2;
	let l = 0;
	let t = 0;
	let r = 1;
	let b = 1;
	//let VertexData = [	l,t,	r,t,	r,b,	l,b	];
	let VertexData = [	l,t,	r,t,	r,b,	r,b, l,b, l,t	];
	let TriangleIndexes = [0,1,2,	2,3,0];
	
	const VertexAttributeName = "TexCoord";

	QuadGeometry = new Pop.Opengl.TriangleBuffer( RenderTarget, VertexAttributeName, VertexData, VertexSize, TriangleIndexes );
	return QuadGeometry;
}



function UnrollHexToRgb(Hexs)
{
	let Rgbs = [];
	let PushRgb = function(Hex)
	{
		let Rgb = Pop.Colour.HexToRgb(Hex);
		Rgbs.push( Rgb[0]/255 );
		Rgbs.push( Rgb[1]/255 );
		Rgbs.push( Rgb[2]/255 );
	}
	Hexs.forEach( PushRgb );
	return Rgbs;
}

//	colours from colorbrewer2.org
const OceanColoursHex = ['#c9e7f2','#4eb3d3','#2b8cbe','#0868ac','#084081','#023859','#03658c','#218da6','#17aebf','#15bfbf'];
const DebrisColoursHex = ['#084081','#0868ac'];
//const OceanColoursHex = ['#f7fcf0','#e0f3db','#ccebc5','#a8ddb5','#7bccc4','#4eb3d3','#2b8cbe','#0868ac','#084081'];
const OceanColours = UnrollHexToRgb(OceanColoursHex);
const ShellColoursHex = [0xF2BF5E,0xF28705,0xBF5B04,0x730c02,0xc2ae8f,0x9A7F5F,0xbfb39b,0x5B3920,0x755E47,0x7F6854,0x8B7361,0xBF612A,0xD99873,0x591902,0xA62103];
const ShellColours = UnrollHexToRgb(ShellColoursHex);
const FogColour = Pop.Colour.HexToRgbf(0x000000);
const LightColour = [0.86,0.95,0.94];

const DebrisColours = UnrollHexToRgb(DebrisColoursHex);

let Camera = new Pop.Camera();
Camera.Position = [ 0,1,17 ];
Camera.LookAt = [ 0,0,0 ];



function TKeyframe(Time,Uniforms)
{
	this.Time = Time;
	this.Uniforms = Uniforms;
}

function TTimeline(Keyframes)
{
	this.Keyframes = Keyframes;
	
	this.GetTimeSlice = function(Time)
	{
		let Slice = {};
		Slice.StartIndex = 0;
		
		for ( let i=0;	i<Keyframes.length-1;	i++ )
		{
			let t = Keyframes[i].Time;
			if ( t > Time )
			{
				//Pop.Debug( "Time > t", Time, t);
				break;
			}
			Slice.StartIndex = i;
		}
		Slice.EndIndex = Slice.StartIndex+1;
		
		let StartTime = Keyframes[Slice.StartIndex].Time;
		let EndTime = Keyframes[Slice.EndIndex].Time;
		Slice.Lerp = Math.RangeClamped( StartTime, EndTime, Time );
		
		//Pop.Debug(JSON.stringify(Slice));
		return Slice;
	}
	
	this.GetUniform = function(Time,Key)
	{
		let Slice = this.GetTimeSlice( Time );
		let UniformsA = Keyframes[Slice.StartIndex].Uniforms;
		let UniformsB = Keyframes[Slice.EndIndex].Uniforms;

		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			
			let Value;
			if ( Array.isArray(a) )
				Value = Math.LerpArray( a, b, Slice.Lerp );
			else
				Value = Math.Lerp( a, b, Slice.Lerp );
			return Value;
		}
		let Value = LerpUniform( Key );
		return Value;
	}
	
	this.EnumUniforms = function(Time,EnumUniform)
	{
		let Slice = this.GetTimeSlice( Time );
		let UniformsA = Keyframes[Slice.StartIndex].Uniforms;
		let UniformsB = Keyframes[Slice.EndIndex].Uniforms;
		let UniformKeys = Object.keys(UniformsA);
		
		let LerpUniform = function(Key)
		{
			let a = UniformsA[Key];
			let b = UniformsB[Key];
			let Value;
			
			if ( Array.isArray(a) )
				Value = Math.LerpArray( a, b, Slice.Lerp );
			else
				Value = Math.Lerp( a, b, Slice.Lerp );

			//Pop.Debug(Key, Value);
			EnumUniform( Key, Value );
		}
		UniformKeys.forEach( LerpUniform );
	}
}

function PhysicsIteration(RenderTarget,Time,PositionTexture,VelocityTexture,ScratchTexture)
{
	return;
	
	let CopyShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	let UpdateVelocityShader = Pop.GetShader( RenderTarget, ParticlePhysicsIteration_UpdateVelocity, QuadVertShader );
	let UpdatePositionsShader = Pop.GetShader( RenderTarget, ParticlePhysicsIteration_UpdatePosition, QuadVertShader );
	let Quad = GetQuadGeometry(RenderTarget);
	
	//	copy old velocitys
	let CopyVelcoityToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture',VelocityTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyVelcoityToScratch );
	
	//	update velocitys
	let UpdateVelocitys = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', 1.0/60.0 );
			Shader.SetUniform('NoiseScale', 0.1 );
			Shader.SetUniform('Gravity', -0.1);
			Shader.SetUniform('Noise', RandomTexture);
			Shader.SetUniform('LastVelocitys',ScratchTexture);
			
			Timeline.EnumUniforms( Time, Shader.SetUniform.bind(Shader) );
		}
		RenderTarget.DrawGeometry( Quad, UpdateVelocityShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( VelocityTexture, UpdateVelocitys );
	
	//	copy old positions
	let CopyPositionsToScratch = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('Texture',PositionTexture);
		}
		RenderTarget.DrawGeometry( Quad, CopyShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( ScratchTexture, CopyPositionsToScratch );
	
	//	update positions
	let UpdatePositions = function(RenderTarget)
	{
		let SetUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [0,0,1,1] );
			Shader.SetUniform('PhysicsStep', 1.0/60.0 );
			Shader.SetUniform('Velocitys',VelocityTexture);
			Shader.SetUniform('LastPositions',ScratchTexture);
			
			Timeline.EnumUniforms( Time, Shader.SetUniform.bind(Shader) );
		}
		RenderTarget.DrawGeometry( Quad, UpdatePositionsShader, SetUniforms );
	}
	RenderTarget.RenderToRenderTarget( PositionTexture, UpdatePositions );
	
}




//const SeaWorldPositionsPlyFilename = 'seatest.ply';
//const SeaWorldPositionsPlyFilename = 'Shell/shellSmall.ply';
const SeaWorldPositionsPlyFilename = 'Shell/shellFromBlender.obj';


function TPhysicsActor(Meta)
{
	this.Position = Meta.Position;
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Meta = Meta;
	
	this.IndexMap = null;
	this.GetIndexMap = function(Positions)
	{
		//	generate
		if ( !this.IndexMap )
		{
			//	add index to each position
			let SetIndex = function(Element,Index)
			{
				Element.push(Index);
			}
			Positions.forEach( SetIndex );
			
			//	sort the positions
			let SortPosition = function(a,b)
			{
				if ( a[2] < b[2] )	return -1;
				if ( a[2] > b[2] )	return 1;
				return 0;
			}
			Positions.sort(SortPosition);
			
			//	extract new index map
			this.IndexMap = [];
			Positions.forEach( xyzi => this.IndexMap.push(xyzi[3]) );
		}
		return this.IndexMap;
	}
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget)
	{
		//	need data initialised
		this.GetTriangleBuffer(RenderTarget);
		
		//Pop.Debug("PhysicsIteration", JSON.stringify(this) );
		PhysicsIteration( RenderTarget, Time, this.PositionTexture, this.VelocityTexture, this.ScratchTexture );
	}
	
	this.ResetPhysicsTextures = function()
	{
		//Pop.Debug("ResetPhysicsTextures", JSON.stringify(this) );
		//	need to init these to zero?
		let Size = [ this.PositionTexture.GetWidth(), this.PositionTexture.GetHeight() ];
		this.VelocityTexture = new Pop.Image(Size,'Float3');
		this.ScratchTexture = new Pop.Image(Size,'Float3');
	}
	
	this.GetPositionsTexture = function()
	{
		return this.PositionTexture;
	}
	
	this.GetVelocitysTexture = function()
	{
		return this.VelocityTexture;
	}

	this.GetTriangleBuffer = function(RenderTarget)
	{
		if ( this.TriangleBuffer )
			return this.TriangleBuffer;
		
		this.PositionTexture = new Pop.Image();
		this.TriangleBuffer = LoadPlyGeometry( RenderTarget, Meta.Filename, this.PositionTexture, Meta.Scale, Meta.VertexSkip, this.GetIndexMap.bind(this) );
		this.ResetPhysicsTextures();
		
		return this.TriangleBuffer;
	}
	
	this.GetTransformMatrix = function()
	{
		//Pop.Debug("physics pos", JSON.stringify(this));
		return Math.CreateTranslationMatrix( ...this.Position );
	}
}

function TAnimationBuffer(Filenames,Scale)
{
	this.Frames = null;
	
	this.Init = function(RenderTarget)
	{
		if ( this.Frames )
			return;
		
		let LoadFrame = function(Filename,Index)
		{
			let FrameDuration = 1/20;
			let Frame = {};
			Frame.Time = Index * FrameDuration;
			Frame.PositionTexture = new Pop.Image();
			Frame.TriangleBuffer = LoadPlyGeometry( RenderTarget, Filename, Frame.PositionTexture, Scale );
			this.Frames.push(Frame);
		}

		this.Frames = [];
		Filenames.forEach( LoadFrame.bind(this) );
	}
	
	this.GetDuration = function()
	{
		return this.Frames[this.Frames.length-1].Time;
	}
	
	this.GetFrame = function(Time)
	{
		Time = Time % this.GetDuration();
		for ( let i=0;	i<this.Frames.length;	i++ )
		{
			let Frame = this.Frames[i];
			if ( Time <= Frame.Time )
				return Frame;
		}
		throw "Failed to find frame for time " + Time;
	}
	
	this.GetTriangleBuffer = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.TriangleBuffer;
	}
	
	this.GetPositionsTexture = function(Time)
	{
		const Frame = this.GetFrame(Time);
		return Frame.PositionTexture;
	}
	
	this.GetVelocitysTexture = function()
	{
		return null;
	}

}


function TAnimatedActor(Meta)
{
	this.Position = Meta.Position;
	this.Animation = new TAnimationBuffer(Meta.Filename,Meta.Scale);
	this.TriangleBuffer = null;
	this.Colours = Meta.Colours;
	this.Time = 0;
	this.Meta = Meta;
	
	this.PhysicsIteration = function(DurationSecs,Time,RenderTarget)
	{
		this.Animation.Init(RenderTarget);
		this.Time = Time;
	}
	
	this.GetTriangleBuffer = function(RenderTarget)
	{
		const tb = this.Animation.GetTriangleBuffer( this.Time );
		return tb;
	}

	this.GetPositionsTexture = function(RenderTarget)
	{
		const tb = this.Animation.GetPositionsTexture( this.Time );
		return tb;
	}
	
	this.GetVelocitysTexture = function(RenderTarget)
	{
		return null;
	}

	this.GetTransformMatrix = function()
	{
		return Math.CreateTranslationMatrix( ...this.Position );
	}
}



const Keyframes =
[
 new TKeyframe(	0,		{	ShellAlpha:1,	PhysicsStep:1/60,	Timeline_CameraPosition:[0,0,	 0]	} ),
 new TKeyframe(	10,		{	ShellAlpha:1,	PhysicsStep:1/60,	Timeline_CameraPosition:[0,-0.20, -5]	} ),
 new TKeyframe(	20,		{	ShellAlpha:1,	PhysicsStep:1/60,	Timeline_CameraPosition:[0,-3.30, -10]	} ),
 new TKeyframe(	28.9,	{	ShellAlpha:1,	PhysicsStep:1/60,	Timeline_CameraPosition:[0,-3.40, -10.1]	} ),
 new TKeyframe(	40,		{	ShellAlpha:1,	PhysicsStep:1/60,	Timeline_CameraPosition:[0,-3.50, -10.2]	} ),
 new TKeyframe(	50,		{	ShellAlpha:1,	PhysicsStep:1/60,	Timeline_CameraPosition:[0,-3.55, -11]	} ),
 new TKeyframe(	110,	{	ShellAlpha:1,	PhysicsStep:1/60,	Timeline_CameraPosition:[0,-3.60, -16]	} ),
];
const Timeline = new TTimeline( Keyframes );

let OceanFilenames = [];
//for ( let i=1;	i<=96;	i++ )
for ( let i=1;	i<=2;	i++ )
	OceanFilenames.push('Ocean/ocean_pts.' + (''+i).padStart(4,'0') + '.ply');

let ShellMeta = {};
ShellMeta.Filename = 'Shell/shellFromBlender.obj';
ShellMeta.Position = [0,0,-2];
ShellMeta.Scale = 0.9;
ShellMeta.TriangleScale = 0.03;
ShellMeta.Colours = ShellColours;
ShellMeta.VertexSkip = 0;

let DebrisMeta = {};
DebrisMeta.Filename = '.random';
DebrisMeta.Position = [0,0,0];
DebrisMeta.Scale = 10;
DebrisMeta.TriangleScale = 0.2015;	//	0.0398
DebrisMeta.Colours = DebrisColours;
DebrisMeta.VertexSkip = 0;


let OceanMeta = {};
OceanMeta.Filename = OceanFilenames;
OceanMeta.Position = [0,0,0];
OceanMeta.Scale = 1.0;
OceanMeta.TriangleScale = 0.0148;
OceanMeta.Colours = OceanColours;

let Actor_Shell = new TPhysicsActor( ShellMeta );
let Actor_Ocean = new TAnimatedActor( OceanMeta );
let Actor_Debris = new TPhysicsActor( DebrisMeta );
//let Actor_Ocean = null;
//let Actor_Debris = null;
let RandomTexture = Pop.CreateRandomImage( 1024, 1024 );


let Params = {};
//	todo: radial vs ortho etc
Params.FogMinDistance = 11.37;
Params.FogMaxDistance = 24.45;
Params.FogColour = FogColour;
Params.LightColour = LightColour;
Params.Ocean_TriangleScale = OceanMeta.TriangleScale;
Params.Debris_TriangleScale = DebrisMeta.TriangleScale;
Params.DebugPhysicsTextures = false;
Params.BillboardTriangles = true;

let OnParamsChanged = function(Params)
{
	if ( Actor_Ocean )
		Actor_Ocean.Meta.TriangleScale = Params.Ocean_TriangleScale;
	
	if ( Actor_Debris )
		Actor_Debris.Meta.TriangleScale = Params.Debris_TriangleScale;
}

const ParamsWindowRect = [800,20,350,200];
let ParamsWindow = new CreateParamsWindow(Params,OnParamsChanged,ParamsWindowRect);
ParamsWindow.AddParam('FogColour','Colour');
ParamsWindow.AddParam('LightColour','Colour');
ParamsWindow.AddParam('Ocean_TriangleScale',0,0.2);
ParamsWindow.AddParam('Debris_TriangleScale',0,0.2);
ParamsWindow.AddParam('FogMinDistance',0,30);
ParamsWindow.AddParam('FogMaxDistance',0,30);
ParamsWindow.AddParam('DebugPhysicsTextures');
ParamsWindow.AddParam('BillboardTriangles');

function RenderActor(RenderTarget,Actor,Time,ActorIndex)
{
	if ( !Actor )
		return;
	
	const PositionsTexture = Actor.GetPositionsTexture();
	const VelocitysTexture = Actor.GetVelocitysTexture();
	const BlitShader = Pop.GetShader( RenderTarget, BlitCopyShader, QuadVertShader );
	const Shader = Pop.GetShader( RenderTarget, ParticleColorShader, ParticleTrianglesVertShader );
	const TriangleBuffer = Actor.GetTriangleBuffer(RenderTarget);
	const Viewport = RenderTarget.GetRenderTargetRect();
	const CameraProjectionTransform = Camera.GetProjectionMatrix(Viewport);
	let WorldToCameraTransform = Camera.GetWorldToCameraMatrix();
	
	//	apply timeline camera pos
	let TimelineCameraPos = Timeline.GetUniform(Time,'Timeline_CameraPosition');
	//WorldToCameraTransform = Math.MatrixMultiply4x4( Math.CreateTranslationMatrix(...TimelineCameraPos), WorldToCameraTransform );
	
	//let Geo = GetAsset( Actor.Geometry, RenderTarget );
	//let Shader = Pop.GetShader( RenderTarget, Actor.FragShader, Actor.VertShader );
	const LocalPositions = [ -1,-1,0,	1,-1,0,	0,1,0	];

	let SetUniforms = function(Shader)
	{
		//	defaults
		Shader.SetUniform('LocalToWorldTransform', Actor.GetTransformMatrix() );
		Shader.SetUniform('LocalPositions', LocalPositions );
		Shader.SetUniform('BillboardTriangles', Params.BillboardTriangles );

		//	global
		Shader.SetUniform('WorldToCameraTransform', WorldToCameraTransform );
		Shader.SetUniform('CameraProjectionTransform', CameraProjectionTransform );
		Shader.SetUniform('Fog_MinDistance',Params.FogMinDistance);
		Shader.SetUniform('Fog_MaxDistance',Params.FogMaxDistance);
		Shader.SetUniform('Fog_Colour',Params.FogColour);
		Shader.SetUniform('Light_Colour', Params.LightColour );
		Shader.SetUniform('Light_MinPower', 0.1 );
		Shader.SetUniform('Light_MaxPower', 1.0 );
		
		Timeline.EnumUniforms( Time, Shader.SetUniform.bind(Shader) );
		
		//	actor specific
		let SetUniform = function(Key)
		{
			let Value = Actor.Uniforms[Key];
			Shader.SetUniform( Key, Value );
		}
		Object.keys( Actor.Uniforms ).forEach( SetUniform );
		
		//	actor
		Shader.SetUniform('WorldPositions',PositionsTexture);
		Shader.SetUniform('WorldPositionsWidth',PositionsTexture.GetWidth());
		Shader.SetUniform('WorldPositionsHeight',PositionsTexture.GetHeight());
		Shader.SetUniform('TriangleScale', Actor.Meta.TriangleScale);
		Shader.SetUniform('Colours',Actor.Colours);
		Shader.SetUniform('ColourCount',Actor.Colours.length/3);
	};
	
	RenderTarget.DrawGeometry( TriangleBuffer, Shader, SetUniforms );
	
	
	if ( Params.DebugPhysicsTextures )
	{
		let w = 0.2;
		let x = ActorIndex * (w * 1.05);
		let Quad = GetQuadGeometry(RenderTarget);
		let SetDebugPositionsUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0, w, 0.25 ] );
			Shader.SetUniform('Texture',PositionsTexture);
		};
		let SetDebugVelocitysUniforms = function(Shader)
		{
			Shader.SetUniform('VertexRect', [x, 0.3, w, 0.25 ] );
			Shader.SetUniform('Texture',VelocitysTexture);
		};
	
		if ( PositionsTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugPositionsUniforms );
		if ( VelocitysTexture )
			RenderTarget.DrawGeometry( Quad, BlitShader, SetDebugVelocitysUniforms );
	}
}



function TActor(Transform,Geometry,VertShader,FragShader,Uniforms)
{
	this.LocalToWorldTransform = Transform;
	this.Geometry = Geometry;
	this.VertShader = VertShader;
	this.FragShader = FragShader;
	this.Uniforms = Uniforms || [];
}

function GetRenderScene()
{
	let Scene = [];
	
	let PushPositionBufferActor = function(Actor)
	{
		const PositionsTexture = Actor.GetPositionsTexture();
		Actor.Uniforms = [];
		Actor.Uniforms['WorldPositions'] = PositionsTexture;
		Actor.Uniforms['WorldPositionsWidth'] = PositionsTexture.GetWidth();
		Actor.Uniforms['WorldPositionsHeight'] = PositionsTexture.GetHeight();
		Actor.Uniforms['TriangleScale']= Actor.Meta.TriangleScale;
		Actor.Uniforms['Colours']= Actor.Colours;
		Actor.Uniforms['ColourCount']= Actor.Colours.length/3;
		//let a = new TActor( )
		Scene.push( Actor );
	}
	
	let ShellAlpha = Timeline.GetUniform(GlobalTime,'ShellAlpha');
	if ( ShellAlpha > 0.5 )
		PushPositionBufferActor( Actor_Shell );
	
	if ( Actor_Debris )
		PushPositionBufferActor( Actor_Debris );
	
	if ( Actor_Ocean )
		PushPositionBufferActor( Actor_Ocean );

	return Scene;
}





let GlobalTime = 0;
function Render(RenderTarget)
{
	const DurationSecs = 1 / 60;
	GlobalTime += DurationSecs;
	
	//	update physics
	if ( Actor_Shell )
		Actor_Shell.PhysicsIteration( DurationSecs, GlobalTime, RenderTarget );
	if ( Actor_Ocean )
		Actor_Ocean.PhysicsIteration( DurationSecs, GlobalTime, RenderTarget );
	if ( Actor_Debris )
		Actor_Debris.PhysicsIteration( DurationSecs, GlobalTime, RenderTarget );

	RenderTarget.ClearColour( ...Params.FogColour );
	
	const Scene = GetRenderScene();
	let RenderSceneActor = function(Actor,ActorIndex)
	{
		RenderActor( RenderTarget, Actor, GlobalTime, ActorIndex );
	}
	Scene.forEach( RenderSceneActor );
	
}

let Window = new Pop.Opengl.Window("Tarqunder the sea");
Window.OnRender = Render;

Window.OnMouseDown = function(x,y,Button)
{
	Window.OnMouseMove( x, y, Button, true );
}

Window.OnMouseMove = function(x,y,Button,FirstClick=false)
{
	if ( Button == 0 )
	{
		Camera.OnCameraPan( x, 0, y, FirstClick );
	}
	if ( Button == 2 )
	{
		Camera.OnCameraPan( x, y, 0, FirstClick );
	}
	if ( Button == 1 )
	{
		Camera.OnCameraOrbit( x, y, 0, FirstClick );
	}
};

