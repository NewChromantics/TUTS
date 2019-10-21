precision mediump float;
varying vec4 Rgba;
varying vec3 TriangleUvIndex;
varying vec3 FragWorldPos;

uniform float TriangleCount;
uniform float StringStrips;

const float CircleRadius = 0.5;


uniform float Fog_MinDistance;
uniform float Fog_MaxDistance;
uniform float3 Fog_Colour;
uniform float3 Fog_WorldPosition;
uniform bool DebugFogCenter;

uniform bool Debug_ForceColour;
#define Debug_Alpha	true

float Range(float Min,float Max,float Value)
{
	return (Value-Min) / (Max-Min);
}

float RangeClamped01(float Min,float Max,float Value)
{
	float t = Range( Min, Max, Value );
	t = clamp( t, 0.0, 1.0 );
	return t;
}


float3 ApplyFog(vec3 Rgb,vec3 WorldPos)
{
	float FogDistance = length( Fog_WorldPosition - WorldPos );
	
	if ( DebugFogCenter )
		if ( FogDistance < 10.0 )
			return float3(1,0,0);
	
	float FogStrength = RangeClamped01( Fog_MinDistance, Fog_MaxDistance, FogDistance );
	Rgb = mix( Rgb, Fog_Colour, FogStrength );
	//Rgb = NormalToRedGreen(FogStrength);
	
	
	return Rgb;
}

float GetStripIndexFromIndex(float Index)
{
	//	Index normal is 0-1 along spline (1 further along length)
	//	we want length-wise strips, so split inside chunks, instead of by-chunk
	float Strips = max( 1.0, StringStrips );
	
	//float Index = IndexNormal * PositionCount;
	float Row = floor( mod( Index, Strips ) );
	return Row;
}
	
void main()
{
	if ( Debug_Alpha )
	{
		float Index = TriangleUvIndex.z;
		float StripIndex = GetStripIndexFromIndex( TriangleUvIndex.z );
		//float SplineNorm = Index / TriangleCount;
		float SplineNorm = StripIndex / StringStrips;
		
		//if ( SplineNorm < 0.5 )
		//	SplineNorm = 0.0;
		//else
		//	SplineNorm = 1.0;
		
		gl_FragColor = mix( float4( 1,0,0,1 ), float4( 0,1,0,1 ), SplineNorm );
		return;
	}

	if ( Debug_ForceColour )
	{
		gl_FragColor = float4(0,1,1,1);
		return;
	}
	
	if ( length(TriangleUvIndex.xy) > CircleRadius )
		discard;

	//	gr: for some reason, this is faster than using a constant!
	gl_FragColor = Rgba;
	
	gl_FragColor.xyz = ApplyFog( gl_FragColor.xyz, FragWorldPos );
}

