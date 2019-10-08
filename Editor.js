Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('PopEngineCommon/PopPly.js');
Pop.Include('PopEngineCommon/PopObj.js');
Pop.Include('PopEngineCommon/PopCollada.js');
Pop.Include('PopEngineCommon/PopCinema4d.js');
Pop.Include('PopEngineCommon/PopTexture.js');
Pop.Include('PopEngineCommon/PopCamera.js');
Pop.Include('PopEngineCommon/ParamsWindow.js');
Pop.Include('PopEngineCommon/PopFrameCounter.js');
Pop.Include('PopEngineCommon/PopCamera.js');

Pop.Include('ParticleActor.js');

const SceneFilename = 'CameraSpline.dae.json';

var Noise_TurbulenceTexture = new Pop.Image( [512,512], 'Float4' );
var OceanColourTexture = new Pop.Image();
var DebrisColourTexture = new Pop.Image();

const GpuJobs = [];

const PhysicsEnabled = true;
var PhsyicsUpdateCount = 0;	//	gotta do one


Params.DrawBoundingBoxes = true;
Params.DrawHighlightedActors = true;

//var EditorParams = {};
const EditorParams = Params;
//EditorParams.ActorNodeName = 'Animal_XXX';
EditorParams.ActorNodeName = OceanActorPrefix + 'x';
EditorParams.ActorNodeName = SceneFilename;
EditorParams.ActorNodeName = DustActorPrefix;

EditorParams.EnablePhysicsAfterSecs = 2;

EditorParams.Turbulence_Frequency = 4.0;
EditorParams.Turbulence_Amplitude = 1.0;
EditorParams.Turbulence_Lacunarity = 0.10;
EditorParams.Turbulence_Persistence = 0.20;
EditorParams.Turbulence_TimeScalar = 0.14;

var Hud = {};
InitDebugHud(Hud);




function CreateDebugCamera(Window,OnClicked,OnGrabbedCamera,OnMouseMove)
{
	OnClicked = OnClicked || function(){};
	OnGrabbedCamera = OnGrabbedCamera || function(){};
	OnMouseMove = OnMouseMove || function(){};

	const Camera = new Pop.Camera();
	Camera.Position = [0,0.5,2];
	
	Window.OnMouseDown = function(x,y,Button)
	{
		if ( Button == 0 )
		{
			OnClicked( x, y );
		}
		Window.OnMouseMove( x, y, Button, true );
	}
	
	Window.OnMouseMove = function(x,y,Button,FirstClick=false)
	{
		OnMouseMove( x, y );
		
		if ( Button == 0 )
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			Camera.OnCameraPanLocal( x, 0, -y, FirstClick );
		}
		if ( Button == 2 )
		{
			x *= Params.ScrollFlySpeed;
			y *= Params.ScrollFlySpeed;
			OnGrabbedCamera(true);
			Camera.OnCameraPanLocal( x, y, 0, FirstClick );
		}
		if ( Button == 1 )
		{
			OnGrabbedCamera(true);
			Camera.OnCameraOrbit( x, y, 0, FirstClick );
		}
	}
	
	Window.OnMouseScroll = function(x,y,Button,Delta)
	{
		let Fly = Delta[1] * 10;
		Fly *= Params.ScrollFlySpeed;
		
		OnGrabbedCamera(true);
		Camera.OnCameraPanLocal( 0, 0, 0, true );
		Camera.OnCameraPanLocal( 0, 0, Fly, false );
	}
	
	return Camera;
}


function FlushGpuJobs(RenderTarget)
{
	const RunJob = function(Job)
	{
		Job( RenderTarget );
	}
	GpuJobs.forEach( RunJob );
	
	GpuJobs.length = 0;
}


function GetRenderScene(GetActorScene,Time)
{
	let Scene = [];
	
	let PushActorBox = function(LocalToWorldTransform,BoundsMin,BoundsMax,Filled=Params.DrawBoundingBoxesFilled)
	{
		//	bounding box to matrix...
		const BoundsSize = Math.Subtract3( BoundsMax, BoundsMin );
		
		//	cube is currently -1..1 so compensate. Need to change shader if we change this
		BoundsSize[0] /= 2;
		BoundsSize[1] /= 2;
		BoundsSize[2] /= 2;
		
		const BoundsCenter = Math.Lerp3( BoundsMin, BoundsMax, 0.5 );
		let BoundsMatrix = Math.CreateTranslationMatrix(...BoundsCenter);
		BoundsMatrix = Math.MatrixMultiply4x4( BoundsMatrix, Math.CreateScaleMatrix(...BoundsSize) );
		BoundsMatrix = Math.MatrixMultiply4x4( LocalToWorldTransform, BoundsMatrix );
		
		const BoundsActor = new TActor();
		const BoundsLocalScale = []
		BoundsActor.LocalToWorldTransform = BoundsMatrix;
		BoundsActor.Geometry = 'Cube';
		BoundsActor.RenderShader = GeoEdgeShader;
		BoundsActor.Uniforms['ChequerFrontAndBack'] = Filled;
		BoundsActor.Uniforms['ChequerSides'] = Filled;
		BoundsActor.Uniforms['LineWidth'] = 0.05;
		
		Scene.push( BoundsActor );
	}
	
	let PushActorBoundingBox = function(Actor,ForceDraw)
	{
		if ( !ForceDraw )
			if ( !Params.DrawBoundingBoxes && !Params.DrawBoundingBoxesFilled )
				return;
		
		//	has no bounds!
		const BoundingBox = Actor.GetBoundingBox();
		if ( !BoundingBox )
		{
			Pop.Debug("Actor has no bounds",Actor);
			return;
		}
		
		PushActorBox( Actor.GetLocalToWorldTransform(), BoundingBox.Min, BoundingBox.Max );
	}
	
	
	
	let PushCameraPosActor = function(Position)
	{
		const Actor = new TActor();
		const LocalScale = Params.DebugCameraPositionScale;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix(...Position);
		Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( Actor.LocalToWorldTransform, Math.CreateScaleMatrix(LocalScale) );
		Actor.Geometry = 'Cube';
		Actor.RenderShader = GeoColourShader;
		Scene.push( Actor );
	}
	
	function RenderTextureQuad(Texture,TextureIndex)
	{
		if ( !Texture.Pixels )
			return;
		
		let w = 0.1;
		let h = 0.2;
		let x = 0.1;
		let y = 0.1 + (TextureIndex * h * 1.10);
		
		const Uniforms = {};
		Uniforms['VertexRect'] = [x, y, w, h ];
		Uniforms['Texture'] = Texture;
		
		const Actor = new TActor( null, 'Quad', BlitCopyShader, Uniforms );
		Scene.push( Actor );
	}
	
	const DebugTextures = [];
	//if ( Params.DebugNoiseTextures )
	{
		DebugTextures.push( OceanColourTexture );
		DebugTextures.push( DebrisColourTexture );
		DebugTextures.push( RandomTexture );
		DebugTextures.push( Noise_TurbulenceTexture );
	}
	DebugTextures.forEach( RenderTextureQuad );
	
	const ActorScene = GetActorScene();
	ActorScene.forEach( a => PushActorBoundingBox(a) );
	ActorScene.forEach( a => Scene.push(a) );
	
	
	return Scene;
}


function GetEditorRenderScene(ActorScene,Time)
{
	function GetActorScene()
	{
		return ActorScene;
	}
	
	const RenderScene = GetRenderScene( GetActorScene, Time );
	return RenderScene;
}

function CreateCubeActor(ActorNode,Solid=false)
{
	let Actor = new TActor();
	Actor.Name = ActorNode.Name;
	
	let LocalScale = ActorNode.Scale;
	let WorldPos = ActorNode.Position;
	Actor.Geometry = 'Cube';
	
	//	some nodes have no geometry, so no bounding box
	if ( !ActorNode.BoundingBox )
	{
		ActorNode.BoundingBox = {};
		ActorNode.BoundingBox.Min = [0,0,0];
		ActorNode.BoundingBox.Max = [1,1,1];
	}
	
	const RenderAsBounds = true;
	if ( RenderAsBounds )
	{
		//	undo the bounds scale and render the cube at the bounds scale
		//	but that'll scale bounds too, so undo that (just to 0..1)
		let BoundsCenter = Math.Lerp3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min, 0.5 );
		let BoundsScale = Math.Subtract3( ActorNode.BoundingBox.Max, ActorNode.BoundingBox.Min );
		
		BoundsScale = Math.Multiply3( BoundsScale, [0.5,0.5,0.5] );
		
		LocalScale = BoundsScale;
		WorldPos = Math.Add3( WorldPos, BoundsCenter );
		ActorNode.BoundingBox.Max = [1,1,1];
		ActorNode.BoundingBox.Min = [-1,-1,-1];
		Pop.Debug( ActorNode.Name, "BoundsScale", BoundsScale, "ActorNode.Scale", ActorNode.Scale );
	}
	
	let LocalScaleMtx = Math.CreateScaleMatrix( ...LocalScale );
	let WorldPosMtx = Math.CreateTranslationMatrix( ...WorldPos );
	
	Actor.LocalToWorldTransform = Math.MatrixMultiply4x4( WorldPosMtx, LocalScaleMtx );
	
	Actor.RenderShader = (Solid===true) ? GeoColourShader : GeoEdgeShader;
	Actor.BoundingBox = ActorNode.BoundingBox;
	
	return Actor;
}


function CreateSplineActor(Spline)
{
	//	turn into bezier
	Pop.Debug("Spline",Spline);
}

function CreateEditorActorScene()
{
	let Scene = [];
	
	let OnActor = function(ActorNode)
	{
		if ( ActorNode.Name == SceneFilename )
		{
			GetDebugSceneActors( SceneFilename, a => Scene.push(a) );
			return;
		}
	
		Pop.Debug("Loading actor", ActorNode.Name, ActorNode );
		let Actor = new TActor();
		Actor.Name = ActorNode.Name;
	
		let IsAnimalActor = true;//IsActorSelectable(Actor);
		const IsDebrisActor = ActorNode.Name.startsWith(DebrisActorPrefix);
		const IsDustActor = ActorNode.Name.startsWith(DustActorPrefix);
		const IsOceanActor = ActorNode.Name.startsWith(OceanActorPrefix);
		const IsSwirlActor = ActorNode.Name.startsWith(SwirlActorPrefix);
		
		let WorldPos = ActorNode.Position;
		Actor.LocalToWorldTransform = Math.CreateTranslationMatrix( ...WorldPos );
		Actor.BoundingBox = ActorNode.BoundingBox;
		
		if ( IsSwirlActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetSwirlMeta().Filename, GetSwirlMeta );
		}
		else if ( IsDustActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetDustMeta().Filename, GetDustMeta );
		}
		else if ( IsOceanActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetOceanMeta().Filename, GetOceanMeta );
		}
		else if ( IsDebrisActor )
		{
			SetupAnimalTextureBufferActor.call( Actor, GetDebrisMeta().Filename, GetDebrisMeta );
		}
		else
		{
			const Animal = GetRandomAnimal( ActorNode.Name );
			Actor.Animal = Animal;
			Actor.Name += " " + Animal.Name;
			let GetMeta = GetAnimalMeta;
			if ( ActorNode.Name.startsWith( NastyAnimalPrefix ) )
				GetMeta = GetNastyAnimalMeta;
			if ( ActorNode.Name.startsWith( BigBangAnimalPrefix ) )
				GetMeta = GetBigBangAnimalMeta;
			SetupAnimalTextureBufferActor.call( Actor, Animal.Model, GetMeta );
		}
		
		/*
		const Animal = GetRandomAnimal( ActorNode.Name );
		Actor.Animal = Animal;
		Actor.Name += " " + Animal.Name;
		let GetMeta = GetAnimalMeta;
		if ( ActorNode.Name.startsWith( NastyAnimalPrefix ) )
			GetMeta = GetNastyAnimalMeta;
		if ( ActorNode.Name.startsWith( BigBangAnimalPrefix ) )
			GetMeta = GetBigBangAnimalMeta;
		SetupAnimalTextureBufferActor.call( Actor, Animal.Model, GetMeta );
		 */
		Scene.push( Actor );
	}
	
	//	create a dumb actor
	let PreviewActorNode = {};
	PreviewActorNode.Name = EditorParams.ActorNodeName;
	
	PreviewActorNode.BoundingBox = {};
	PreviewActorNode.BoundingBox.Min = [-10,-10,-10];
	PreviewActorNode.BoundingBox.Max = [10,10,10];
	PreviewActorNode.Scale = [1,1,1];
	PreviewActorNode.Position = [0,0,0];
	
	OnActor( PreviewActorNode );
	
	Scene = Scene.filter( a => (a!=null) );
	
	return Scene;
}



function GetDebugSceneActors(Filename,EnumActor)
{
	const FileScene = LoadSceneFile(Filename);
	//	ignore the actors
	const CubeActors = FileScene.Actors.map( CreateCubeActor );
	CubeActors.forEach( EnumActor );
	
	//	draw splines
	const SplineActors = FileScene.Splines.map( CreateSplineActor );
	SplineActors.forEach( EnumActor );
	
	/*
	 const Timeline = new TTimeline( FileScene.Keyframes );
	 GetCameraTimelineAndUniform = function()
	 {
	 return [Timeline,'CameraPosition'];
	 }
	 */
}


class TAssetEditor
{
	constructor(Name)
	{
		this.Window = new Pop.Opengl.Window(Name);
		this.Window.OnRender = this.Render.bind(this);
		this.Camera = CreateDebugCamera(this.Window);
		this.Time = 0;
		this.Scene = CreateEditorActorScene();
		this.SceneInitTime = this.Time;

		this.CreateEditorParamsWindow();
	}
	
	Update(FrameDurationSecs,Time)
	{
		this.Time = Time;
		//Pop.Debug("Update",FrameDurationSecs);
		
		const SceneTime = ( this.Time - this.SceneInitTime );
		if ( SceneTime > EditorParams.EnablePhysicsAfterSecs )
		{
			this.Scene[0].UpdatePhysics = true;
		}
		
		
		const AppTime = Time;
		const Params = EditorParams;
		
		const UpdateNoise = function(RenderTarget)
		{
			const NoiseTime = AppTime * Params.Turbulence_TimeScalar;
			UpdateNoiseTexture( RenderTarget, Noise_TurbulenceTexture, Noise_TurbulenceShader, NoiseTime );
		}
		
		const Scene = this.Scene;
		const UpdateActorPhysics = function(RenderTarget)
		{
			const UpdateActorPhysics = function(Actor)
			{
				//	only update actors visible
				//	gr: maybe do this with the actors in scene from GetRenderScene?
				const UpdatePhysicsUniforms = function(Shader)
				{
					const Bounds = Actor.BoundingBox.Min.concat( Actor.BoundingBox.Max );
					Shader.SetUniform('OrigPositionsBoundingBox',Bounds);
				}
				Actor.PhysicsIteration( FrameDurationSecs, AppTime, RenderTarget, UpdatePhysicsUniforms );
			}
			
			
			//	update physics
			if ( PhysicsEnabled || PhsyicsUpdateCount == 0 )
			{
				Scene.forEach( UpdateActorPhysics );
				PhsyicsUpdateCount++;
			}
		}
		
		GpuJobs.push( UpdateNoise );
		GpuJobs.push( UpdateActorPhysics );
	}
	

	Render(RenderTarget)
	{
		FlushGpuJobs( RenderTarget );

		const Scene = GetEditorRenderScene( this.Scene, this.Time );
		
		//Pop.Debug("Render",RenderTarget);
		RenderTarget.ClearColour( ...EditorParams.FogColour );
		
		const GlobalUniforms = {};
		GlobalUniforms['Fog_MinDistance'] = 100;
		GlobalUniforms['Fog_MaxDistance'] = 100;
		GlobalUniforms['Fog_Colour'] = [1,0,0];
		GlobalUniforms['Fog_WorldPosition'] = this.Camera.Position;

		RenderScene( Scene, RenderTarget, this.Camera, this.Time, GlobalUniforms );
		
		Window.RenderFrameCounter.Add();
		UpdateDebugHud(Hud);
	}
	
	CreateEditorParamsWindow()
	{
		const ParamsWindowRect = [1100,20,350,450];
		this.ParamsWindow = CreateParamsWindow( EditorParams, this.OnEditorParamsChanged.bind(this), ParamsWindowRect );
		
		this.ParamsWindow.AddParam('ActorNodeName');
		this.ParamsWindow.AddParam('Reload','Button');
		this.ParamsWindow.AddParam('EnablePhysicsAfterSecs',0,10);

		EditorParams.InitParamsWindow( this.ParamsWindow );
	}
	
	OnEditorParamsChanged(Params,ChangedParamName)
	{
		Pop.Debug("Param changed",ChangedParamName);
		
		//	reload scene if actor changes
		if ( ChangedParamName == 'ActorNodeName' || ChangedParamName == 'Reload' )
		{
			this.Scene = CreateEditorActorScene();
			this.SceneInitTime = this.Time;
		}
	}
	
}

