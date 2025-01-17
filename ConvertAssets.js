//Pop.Include('AssetImport.js');
//Pop.Include('Animals.js');



function ConvertSceneFile(Filename,Pretty=false)
{
	const CachedFilename = GetCachedFilename(Filename,'scene');
	if ( Pop.FileExists(CachedFilename) )
	{
		return;
	}
	const Scene = LoadSceneFile( Filename );
	const Json = Pretty ? JSON.stringify(Scene,null,'\t') : JSON.stringify(Scene);
	Pop.WriteStringToFile( CachedFilename, Json );
	//Pop.ShowFileInFinder( CachedFilename );
}



function ConvertGeometryFile(Filename,Pretty=false)
{
	Pop.Debug('ConvertGeometryFile',Filename);
	const CachedFilename = GetCachedFilename(Filename,'geometry');

	if ( Pop.FileExists(CachedFilename) )
	{
		return;
	}
	Pop.Debug('ConvertGeometryFile','LoadGeometryFile');
	const Geo = LoadGeometryFile( Filename );
	//const Json = Pretty ? JSON.stringify(Geo,null,'\t') : JSON.stringify(Geo);
	Pop.Debug('ConvertGeometryFile','JSON.stringify');
	const Json = JSON.stringify(Geo);
	Pop.WriteStringToFile( CachedFilename, Json );
	//Pop.ShowFileInFinder( CachedFilename );
}


function ConvertTextureBufferFile(Filename,Index)
{
	const IsOceanFilename = Filename.startsWith('Ocean');
	const CachedFilename = GetCachedFilename(Filename,'texturebuffer.png');
	if ( Pop.FileExists(CachedFilename) )
	{
		return;
	}
	const Geo = LoadGeometryFile( Filename );
	const MaxPositons = 1024*1024;
	Pop.Debug("Converting "+Filename+" geo to Texture Buffer",Geo);
	
	const PositionFormat = IsOceanFilename ? 'Float3' : 'RGB';
	const ScaleToBounds = { Min:[0,0,0], Max:[1,1,1] };
	const PadImages = false;
	const TextureBuffers = LoadGeometryToTextureBuffers( Geo, MaxPositons, ScaleToBounds, PositionFormat, PadImages );

	//	dont write this
	TextureBuffers.AlphaTexture = null;
	
	const PackedImage = CreatePackedImage(TextureBuffers);
	
	const WritePngBytes = function(PngBytes)
	{
		Pop.Debug("Writing PNG", CachedFilename);
		Pop.WriteToFile( CachedFilename, PngBytes );
		if ( Index == 0 )
		{
			Pop.ShowFileInFinder( CachedFilename );
			//Pop.Debug("Png bytes",PngBytes);
		}
	}
	ImageToPng( PackedImage, WritePngBytes );

}


//	convert some assets

const GeoFiles =
[
 	'Logo/Logo.svg.json',
];


const SceneFiles =
[
 'CameraSpline.dae.json'
 ];

const TextureBufferFiles =
[
];

TextureBufferFiles.push( ...GetAnimalAssetFilenames() );

Pop.Debug( TextureBufferFiles );

TextureBufferFiles.forEach( ConvertTextureBufferFile );
SceneFiles.forEach( ConvertSceneFile );
//GeoFiles.forEach( ConvertGeometryFile );
