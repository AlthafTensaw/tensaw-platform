import asyncio
from tensaw_base.auth.verifier import CognitoJwtVerifier

async def test():
    token = "eyJraWQiOiIrSEJQazhaajhyQUlHM2hhYTVQNGZjcDRBR2FUR0h6YWpPZVJZY3FoZlBzPSIsImFsZyI6IlJTMjU2In0.eyJ0ZW5hbnRfaWQiOiJwcmltcm9zZSIsInN1YiI6ImU0YThmNDM4LWEwNDEtNzBlMi01ZTExLTI3OTM0ZjgyYWVmZSIsImNvZ25pdG86Z3JvdXBzIjpbIlRFTkFOVF9BRE1JTiJdLCJpc3MiOiJodHRwczovL2NvZ25pdG8taWRwLnVzLWVhc3QtMS5hbWF6b25hd3MuY29tL3VzLWVhc3QtMV9QVTF5aEZoQ3giLCJkaXNwbGF5X25hbWUiOiJkZW1vQHRlbnNhdy5kZXYiLCJjbGllbnRfaWQiOiI3ZnA1OTlpaWJjdnZwb2c3czV1bGM4cThmaCIsIm9yaWdpbl9qdGkiOiI4NDI3NmIzOS05MWNlLTRhYjAtYmVhMC1hMDIyMDg1Y2FkY2QiLCJldmVudF9pZCI6ImRlMTc2MWIxLTYxZGQtNDczYi04NmI0LWEzZTY5OGU1Y2I0OSIsInRva2VuX3VzZSI6ImFjY2VzcyIsInNjb3BlIjoiYXdzLmNvZ25pdG8uc2lnbmluLnVzZXIuYWRtaW4iLCJhdXRoX3RpbWUiOjE3ODEwMDYzMDIsImV4cCI6MTc4MTAwNzI0NiwiaWF0IjoxNzgxMDA2OTQ2LCJqdGkiOiJjMjgyOWViYS1jNTRmLTRmY2EtOWEyYS1lMDhjYzgyMjZjNTAiLCJ1c2VybmFtZSI6ImRlbW9AdGVuc2F3LmRldiJ9.cNYyDg3A9Ytt78T0L1bU_FOGSGTdVBGVfOFi4Ia77RujhVtsYymnzq6j4LcccTqJIbMwXY0my85MtSSWfcHz0E-LU5dSzThUaqmbdy670l6wAHqK9MJDuS1BAF9Lil8R7ZATE7pwiYELQfB1dIEjSFRsnFUD9VjCUpe35DSOZHz7_kpElbSnNg6w7tCaN005NGh-0ffNNbK5ZswQoZBSK4X4ftcbvoPcl3eQZ7qlDM_CxcKybiOxHLpa3Bi48B3UPLbkDFkf95JUpsyoEGjzyVF5i1zuh8Rd21l-1F_VOBPY-s8tv5ESKWQhQEBkvR09TZGHNWouIeFy0dlGg9fMkA"
    verifier = CognitoJwtVerifier(
        issuer="https://cognito-idp.us-east-1.amazonaws.com/us-east-1_PU1yhFhCx",
        audience="7fp599iibcvvpog7s5ulc8q8fh",
        region="us-east-1",
        user_pool_id="us-east-1_PU1yhFhCx"
    )
    try:
        identity = await verifier.verify_user_token(f"Bearer {token}")
        print("Success:", identity)
    except Exception as e:
        print("Error:", type(e).__name__, "-", str(e))

asyncio.run(test())
