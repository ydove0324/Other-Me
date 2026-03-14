aliyun OSS 示例
```
import oss2
from oss2.credentials import EnvironmentVariableCredentialsProvider
from flask import Flask, jsonify

app = Flask(__name__)

# 初始化 OSS 客户端（建议使用环境变量管理密钥）
auth = oss2.ProviderAuthV4(EnvironmentVariableCredentialsProvider())
endpoint = "https://oss-cn-hangzhou.aliyuncs.com"
region = "cn-hangzhou"
bucket_name = "hx-img-oss"
bucket = oss2.Bucket(auth, endpoint, bucket_name, region=region)

# 生成前端上传用的签名 URL（有效期3600秒）
@app.route('/sign-upload-url')
def sign_upload_url():
    object_key = "user-uploads/image.jpg"  # 可动态生成唯一 key
    signed_url = bucket.sign_url('PUT', object_key, 3600)
    return jsonify({"url": signed_url, "key": object_key})

# （可选）提供带图片处理的下载链接
@app.route('/get-image-url')
def get_image_url():
    object_key = "user-uploads/image.jpg"
    # 若 Bucket 为私有，需签名；若为公共读，可直接拼接 URL
    public_url = f"https://{bucket_name}.{region}.aliyuncs.com/{object_key}"
    return jsonify({"url": public_url})
```
前端
```
import oss2
from oss2.credentials import EnvironmentVariableCredentialsProvider
from flask import Flask, jsonify

app = Flask(__name__)

# 初始化 OSS 客户端（建议使用环境变量管理密钥）
auth = oss2.ProviderAuthV4(EnvironmentVariableCredentialsProvider())
endpoint = "https://oss-cn-hangzhou.aliyuncs.com"
region = "cn-hangzhou"
bucket_name = "hx-img-oss"
bucket = oss2.Bucket(auth, endpoint, bucket_name, region=region)

# 生成前端上传用的签名 URL（有效期3600秒）
@app.route('/sign-upload-url')
def sign_upload_url():
    object_key = "user-uploads/image.jpg"  # 可动态生成唯一 key
    signed_url = bucket.sign_url('PUT', object_key, 3600)
    return jsonify({"url": signed_url, "key": object_key})

# （可选）提供带图片处理的下载链接
@app.route('/get-image-url')
def get_image_url():
    object_key = "user-uploads/image.jpg"
    # 若 Bucket 为私有，需签名；若为公共读，可直接拼接 URL
    public_url = f"https://{bucket_name}.{region}.aliyuncs.com/{object_key}"
    return jsonify({"url": public_url})
```

图像生成SDK
````
from openai import OpenAI
 
openai_client = OpenAI(
    base_url="https://aiping.cn/api/v1",
    api_key="QC-588fa1a9bf489a65387c9ca8be14f04b-8c5549e10a6e7b596a6f05c666115998",
)
 
response = openai_client._client.post(
    "/images/generations",
    json={
        "model": "Qwen-Image-2.0-Pro",
        "prompt": "一个宇航员在都市街头漫步",
        "negative_prompt": "模糊，低质量",
        "image": "http://wanx.alicdn.com/material/20250318/stylization_all_1.jpeg",  # 图像编辑模型必填
        "extra_body": {
            "provider": {
                "only": [], 
                "order": [],
                "sort": None,
                "output_price_range": [],
                "latency_range": []
            }
        }
    },
    headers={
        "Authorization": "Bearer QC-588fa1a9bf489a65387c9ca8be14f04b-8c5549e10a6e7b596a6f05c666115998",
        "Content-Type": "application/json"
    }
)
 
print(response.json())
```

第一步
- 在onboarding 阶段提示用户上传自己的图片(用户可以不上传，然后警告，如果上传后面生成的故事会更加真实哦), 然后可以让用户选择是否作为自己的 Avatar

第二步
- 如果用户有上传，给用户生成一个漫画角色，并上传 AliYun OSS

第三步

- 后面生成LifeTime Story 的时候，结合用户的漫画角色，和 AI 生成的故事，生成对应的图像, 要让 AI 先生成全部的故事，然后规划一下，4 ～ 5 个 BLock 图像都要是什么（要连贯），然后再并发生成图像, 然后都存到 AliYun OSS


export OSS_ACCESS_KEY_ID='YOUR_ACCESS_KEY_ID'
export OSS_ACCESS_KEY_SECRET='YOUR_ACCESS_KEY_SECRET'