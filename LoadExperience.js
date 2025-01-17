Pop.Include('PopEngineCommon/PopMath.js');
Pop.Include('Animals.js');

const MinimumLogoSecs = 0.01;

function HideLogoElements()
{
	let Div = new Pop.Hud.Label('Logo');
	Div.SetVisible(false);
}

function ShowLogoElements()
{
	let Div = new Pop.Hud.Label('Logo');
	Div.SetVisible(true);
}


function IsImageFilename(Filename)
{
	return Filename.toLowerCase().endsWith('.png');
}

function IsValidFilename(Filename)
{
	if (!Filename)
		return false;
	if (Filename.startsWith('.'))
		return false;
	return true;
}

async function DoPreloadFileset(Filenames)
{
	for (const Filename of Filenames)
	{
		try
		{
			const AsyncCacheFunction = IsImageFilename(Filename) ? Pop.AsyncCacheAssetAsImage : Pop.AsyncCacheAssetAsString;
			await AsyncCacheFunction(Filename);
			return;
		}
		catch (e)
		{
			//	error, try next
			//Pop.Debug(`Error loading ${Filename} of ${Filenames};`,e);
		}
	}
	throw `Failed to load any files for ${Filenames}`;
}

async function DoPreloadFiles(FilenameSets)
{
	//	kick off each async load
	const Promises = [];
	for ( const FilenameSet of FilenameSets )
	{
		Promises.push(DoPreloadFileset(FilenameSet));
	}

	//	wait for all to finish
	await Promise.all(Promises);
}


async function DoPreloadGeoTextureBufferAsset(Filename)
{
	//	gr: not actually async... but adding a yield makes these load over multiple frames
	await Pop.Yield(1);

	//const AddNoise = Meta.AddNoiseToTextureBuffer !== false;
	const AddNoise = true;

	//	setup the fetch func on demand, if already cached, won't make a difference
	AssetFetchFunctions[Filename] = function (RenderContext)
	{
		return LoadAssetGeoTextureBuffer(RenderContext,Filename,AddNoise);
	};
	const TextureBuffers = GetAsset(Filename,FakeRenderTarget);
}

async function DoPreloadAssets(Filenames)
{
	const Promises = [];
	for (const Filename of Filenames)
	{
		//	instead of waiting for all, do one by one which forces one per frame
		//	gr: if each is like 5ms, could do 2 per frame..
		const LoadPromise = DoPreloadGeoTextureBufferAsset(Filename);
		//Promises.push(LoadPromise);
		await LoadPromise;
	}

	//	wait for all to finish
	await Promise.all(Promises);
}


function TLogoState()
{
	this.StartButton = null;
	this.StartButtonPressed = false;
	this.PreloadFinished = false;
	this.PreloadFilenames =
	[
		//	assets
		'Timeline.json',
	 'TextTimeline1.json',
	 'TextTimeline2.json',
	 'TextTimeline3.json',
		'Animals.json',
	 
		'Quad.vert.glsl',
		'ParticleTriangles.vert.glsl',
		'BlitCopy.frag.glsl',
	 	'BlitCopyMultiple.frag.glsl',
		'Geo.vert.glsl',
		'Colour.frag.glsl',
		'Edge.frag.glsl',
		'PhysicsIteration_UpdateVelocity.frag.glsl',
		'PhysicsIteration_UpdateVelocityPulse.frag.glsl',
	 	'PhysicsIteration_UpdateVelocitySwirl.frag.glsl',
	 	'PhysicsIteration_UpdatePosition.frag.glsl',
	 	'PhysicsIteration_UpdatePositionSwirl.frag.glsl',
	 	'PhysicsIteration_UpdateSwirl.frag.glsl',
	 
	 	'NastyAnimalParticle.frag.glsl',
	 	'NastyAnimalParticle.vert.glsl',
		'AnimalParticle.frag.glsl',
	 	'AnimalParticle.vert.glsl',
		'DustParticle.vert.glsl',
		'WaterParticle.vert.glsl',
	 	'TurbulencePerlin.frag.glsl',

		//	code
	 	'Timeline.js',
		'AcidicOcean.js',
	 	'AssetManager.js',
	 	'AudioManager.js',
		'Hud.js',
		'PopEngineCommon/PopShaderCache.js',
		'PopEngineCommon/PopFrameCounter.js',
		'PopEngineCommon/PopCamera.js',
		'PopEngineCommon/PopMath.js',
		'PopEngineCommon/ParamsWindow.js',
		'PopEngineCommon/PopPly.js',
		'PopEngineCommon/PopObj.js',
		'PopEngineCommon/PopCollada.js',
		'PopEngineCommon/PopCinema4d.js',
		'PopEngineCommon/PopTexture.js'
	];
	this.PreloadSceneFilenames =
	[
	 'CameraSpline.dae.json'
	];

	//	autogen model asset filenames
	this.PreloadGeoFilenames = GetAnimalAssetFilenames();
	
	//	generate list of files to load
	const PreloadFilenameSets = [];
	const PreloadAssets = GetAnimalAssetFilenames();

	function QueueFile(Filename)
	{
		PreloadFilenameSets.push([Filename]);
	}

	function QueueAssetFile(Filename,Types)
	{
		const AssetFilenames = [];
		//	add cached filenames first
		Types.forEach(t => AssetFilenames.push(GetCachedFilename(Filename,t)));
		//	then original filename
		AssetFilenames.push(Filename);
		PreloadFilenameSets.push(AssetFilenames);
	}

	this.PreloadFilenames.forEach(QueueFile );
	//this.PreloadGeoFilenames.forEach( f => QueueAssetFile( f, ['texturebuffer.png','geometry'] ) );
	this.PreloadGeoFilenames.forEach(f => QueueAssetFile( f, ['texturebuffer.png'] ) );
	this.PreloadSceneFilenames.forEach(f => QueueAssetFile( f, ['scene'] ) );

	//	actual preload sequence
	this.Preload = async function()
	{
		await DoPreloadFiles(PreloadFilenameSets);
		await DoPreloadAssets(PreloadAssets);
	}

	this.ShowStartButton = function ()
	{
		this.StartButton.SetVisible(true);
	}

	this.CreateStartButton = function ()
	{
		function OnClickedStart()
		{
			Pop.Debug("Start clicked");
			this.StartButtonPressed = true;
		}
		this.StartButton = new Pop.Hud.Button('Hint_Start');
		this.StartButton.OnClicked = OnClickedStart.bind(this);
		this.StartButton.SetVisible(false);
	}
	this.CreateStartButton();
}

let LogoState = null;

function Update_LoadExperience(FirstUpdate,UpdateDuration,StateTime)
{
	//	setup preloads
	if ( FirstUpdate )
	{
		LogoState = new TLogoState();

		ShowLogoElements();

		function OnPreloadFinished()
		{
			LogoState.PreloadFinished = true;
			LogoState.ShowStartButton();
		}
		function OnPreloadError(Error)
		{
			ShowError(Error);
		}

		LogoState.Preload().then(OnPreloadFinished).catch(OnPreloadError);
	}

	//Pop.Debug("Update_LoadExperience");
	Logo_Update(UpdateDuration);
		
	//	wait minimum of X secs
	//	todo: and button press
	if ( StateTime < MinimumLogoSecs )
	{
		//Pop.Debug("Logo...",StateTime);
		return;
	}

	if (!LogoState.PreloadFinished)
		return;

	//	wait for button to be pressed
	const AssetServerMode = Pop.GetExeArguments().includes('AssetServer');
	const EditorMode = Pop.GetExeArguments().includes('Editor');
	const AutoStart = Pop.GetExeArguments().includes('AutoStart') || AssetServerMode || EditorMode;

	const StartPressed = AutoStart || LogoState.StartButtonPressed;
	if (!StartPressed)
		return;
		
	HideLogoElements();
	
	if ( AssetServerMode )
		return 'AssetServer';
	
	if ( EditorMode )
		return 'Editor';

	return 'Experience';
}


function Update_Experience(FirstUpdate)
{
	if ( FirstUpdate )
	{
		let Source = Pop.LoadFileAsString('AcidicOcean.js');
		Pop.CompileAndRun( Source, 'AcidicOcean.js' );
	}
}

