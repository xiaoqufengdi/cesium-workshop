(function () {
    "use strict";

    // TODO: Add your ion access token from cesium.com/ion/
    // Cesium.Ion.defaultAccessToken = '<YOUR ACCESS TOKEN HERE>';


    //初始化三维场景
    var viewer = new Cesium.Viewer('cesiumContainer', {
        scene3DOnly: true,
        selectionIndicator: true,  //选中地图要素
        baseLayerPicker: false     //是否提供地图切换控件
    });

    //////////////////////////////////////////////////////////////////////////
    // Loading Terrain
    //////////////////////////////////////////////////////////////////////////

 // Load Cesium World Terrain  添加地形-地球表面有山川起伏
    viewer.terrainProvider = Cesium.createWorldTerrain({
        requestWaterMask : true, // required for water effects 水
        requestVertexNormals : true // required for terrain lighting 灯光
    });
    // Enable depth testing so things behind the terrain disappear.
     viewer.scene.globe.depthTestAgainstTerrain = true;

    //////////////////////////////////////////////////////////////////////////
    // Configuring the Scene
    //////////////////////////////////////////////////////////////////////////

    // Enable lighting based on sun/moon positions 阳光
     viewer.scene.globe.enableLighting = true;
     //几个基本的Cesium类型
    //Cartesian3: 3D笛卡尔坐标，以米为单位，原点位于地球中心
    //Cartographic: 由WGS84椭球表面的经度纬度、高度定义位置
    //HeadingPitchRoll：围绕东 - 北 - 上帧中的局部轴的旋转（以弧度表示）。标题是围绕负z轴的旋转。间距是围绕负y轴的旋转。Roll是围绕正x轴的旋转。
    //Quaternion ：表示为4D坐标的3D旋转。

     // Create an initial camera view  初始化相机视图
    var initialPosition = new Cesium.Cartesian3.fromDegrees(-73.998114468289017509, 40.674512895646692812, 2631.082799425431);
    var initialOrientation = new Cesium.HeadingPitchRoll.fromDegrees(7.1077496389876024807, -31.987223091598949054, 0.025883251314954971306);
    var homeCameraView = {
        destination : initialPosition,
        orientation : {
            heading : initialOrientation.heading,
            pitch : initialOrientation.pitch,
            roll : initialOrientation.roll
        }
    };
    // Set the initial view
    viewer.scene.camera.setView(homeCameraView);

   // Add some camera flight animation options
  /*  homeCameraView.duration = 2.0;
    homeCameraView.maximumHeight = 2000;
    homeCameraView.pitchAdjustHeight = 2000;
    homeCameraView.endTransform = Cesium.Matrix4.IDENTITY;
    // Override the default home button
    viewer.homeButton.viewModel.command.beforeExecute.addEventListener(function (e) {
        e.cancel = true;
        viewer.scene.camera.flyTo(homeCameraView);  //回到初始位置
    });*/

     //////////////////////////////////////////////////////////////////////////
     // Load 3D Tileset
     //////////////////////////////////////////////////////////////////////////

     // Load the NYC buildings tileset   加载3D Tiles
     var city = viewer.scene.primitives.add(new Cesium.Cesium3DTileset({ url: Cesium.IonResource.fromAssetId(3839) }));

     // Adjust the tileset height so it's not floating above terrain
     var heightOffset = -32;
     city.readyPromise.then(function(tileset) {
         // Position tileset
         var boundingSphere = tileset.boundingSphere;
         var cartographic = Cesium.Cartographic.fromCartesian(boundingSphere.center);
         var surfacePosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, 0.0);
         var offsetPosition = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, heightOffset);
         var translation = Cesium.Cartesian3.subtract(offsetPosition, surfacePosition, new Cesium.Cartesian3());
         tileset.modelMatrix = Cesium.Matrix4.fromTranslation(translation);
         window.tileset = tileset;
         //绑定事件
         addEvent();
     });


     //////////////////////////////////////////////////////////////////////////
     // Style 3D Tileset
     //////////////////////////////////////////////////////////////////////////

     // Define a white, opaque building style
     var defaultStyle = new Cesium.Cesium3DTileStyle({
         color : "color('white')",
         show : true
     });

     // Set the tileset style to default
     city.style = defaultStyle;

     // Define a white, transparent building style 调整建筑透明度
    var transparentStyle = new Cesium.Cesium3DTileStyle({
         color : "color('white', 0.3)",
         show : true
     });

     // Define a style in which buildings are colored by height
      var heightStyle = new Cesium.Cesium3DTileStyle({
         color : {
             conditions : [
                 ["${height} >= 300", "rgba(45, 0, 75, 0.5)"],
                 ["${height} >= 200", "rgb(102, 71, 151)"],
                 ["${height} >= 100", "rgb(170, 162, 204)"],
                 ["${height} >= 50", "rgb(224, 226, 238)"],
                 ["${height} >= 25", "rgb(252, 230, 200)"],
                 ["${height} >= 10", "rgb(248, 176, 87)"],
                 ["${height} >= 5", "rgb(198, 106, 11)"],
                 ["true", "rgb(127, 59, 8)"]
             ]
         }
     });
    //根据dom节点上下拉值切换样式
     var tileStyle = document.getElementById('tileStyle');
     function set3DTileStyle() {
         var selectedStyle = tileStyle.options[tileStyle.selectedIndex].value;
         if (selectedStyle === 'none') {
             city.style = defaultStyle;
         } else if (selectedStyle === 'height') {
             city.style = heightStyle;
         } else if (selectedStyle === 'transparent') {
             city.style = transparentStyle;
         }
     }
     tileStyle.addEventListener('change', set3DTileStyle);

    function addEvent()
    {
        //鼠标移动到某物体上时显示的信息
        var nameOverlay = document.createElement('div');
        viewer.container.appendChild(nameOverlay);
        nameOverlay.className = 'backdrop';
        nameOverlay.style.display = 'none';
        nameOverlay.style.position = 'absolute';
        nameOverlay.style.bottom = '0';
        nameOverlay.style.left = '0';
        nameOverlay.style['pointer-events'] = 'none';
        nameOverlay.style.padding = '4px';
        nameOverlay.style.backgroundColor = '#59719D';
        nameOverlay.style.color = 'white';
        nameOverlay.border = "1px solid #fff";



/*        var selected = {
            feature: undefined,
            originalColor: new Cesium.Color()  // Cesium.Color.ORANGERED
        };*/
        var selectedFeature = {
            currentFeature: null,
            currentFeaPosition: {x: null, y: null},//来保持当前选中实体的场景坐标
            previousFeature: null
        };
        var previousPickedPrimitive = null;
        var isStartMove = false;
        var isStartRotate = false;
        var handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        var defaultColor = null;
        var overFeatures = [];
        var modelMatrix = window.tileset._modelMatrix;

        //鼠标移动
        handler.setInputAction(function (movement)
        {
            var pickedPrimitive = viewer.scene.pick(movement.endPosition);
            //还原之前鼠标滑过实体的颜色
            if (Cesium.defined(previousPickedPrimitive))
            {
                //如果是当前选中实体则color不动
                if(!(Cesium.defined(selectedFeature.currentFeature) && selectedFeature.currentFeature === previousPickedPrimitive))
                    previousPickedPrimitive.color = defaultColor;
                // previousPickedPrimitive.scale = 1.0;
                // city.style = defaultStyle;
                // previousPickedEntity.color = Cesium.Color.WHITE;
            }
            //高亮鼠标滑过实体的颜色
            if(Cesium.defined(pickedPrimitive))
            {
                var name = pickedPrimitive.getProperty("name");
                if (name)
                {
                    console.log("name: "+name);
                    // 显示滑动信息窗
                    nameOverlay.style.display = 'block';
                    // 设置滑动窗口的位置
                    nameOverlay.textContent = name;
                    nameOverlay.style.bottom = viewer.canvas.clientHeight - movement.endPosition.y + 'px';
                    nameOverlay.style.left = movement.endPosition.x - nameOverlay.clientWidth/2 + 'px';


                    //设置实体滑动样式
                    if(pickedPrimitive !== selectedFeature.currentFeature)
                    {
                        defaultColor = pickedPrimitive.color; //先保存
                        pickedPrimitive.color = Cesium.Color.AZURE;
                        previousPickedPrimitive = pickedPrimitive;
                    }
                    //给有属性的实体添加info
                    //取场景坐标
                    var id = pickedPrimitive.getProperty("id");
                    var isExist = overFeatures.some(function (obj) {
                        return obj.id === id;
                    });
                    if(!isExist)
                    {
                        $(".info").remove();

                        var pickPosition = viewer.scene.pickPosition(movement.endPosition);
                        var infoImg = getInfo();
                        viewer.container.appendChild(infoImg);
                        $(infoImg).css("left", movement.endPosition.x);
                        $(infoImg).css("top", movement.endPosition.y);

                        overFeatures = [{
                            id: id,
                            feature: pickedPrimitive,
                            position: pickPosition,
                            infoImg: infoImg
                        }]
                /*        overFeatures.push({
                            id: id,
                            feature: pickedPrimitive,
                            position: pickPosition,
                            infoImg: infoImg
                        });*/
                    }
                }
                else
                {
                    console.log("没有名称");
                }
            }
            //更新info位置
            if(Cesium.defined(overFeatures.length))
            {
                updateInfo(overFeatures)
            }
            //更新属性框位置
            if(isStartMove && Cesium.defined(selectedFeature.currentFeature))
            {
                //var changePosition = {x: movement.endPosition.x - movement.startPosition.x, y: movement.endPosition.y - movement.startPosition.y};
                //取选中实体的场景坐标在当前屏幕的坐标位置
                var position = viewer.scene.cartesianToCanvasCoordinates(selectedFeature.currentFeaPosition);
                updatePropsDialog(position);
            }
            //旋转
            if(isStartRotate && Cesium.defined(selectedFeature.currentFeature))
            {
                console.log(viewer.camera.heading);
                updateRotate(viewer.camera.heading)
            }

        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        //鼠标左键按下
        handler.setInputAction(function (movement)
        {
            console.log("LEFT_DOWN");
            console.log(movement);
            isStartMove = true;

            if(Cesium.defined(viewer.scene.pick(movement.position)))
            {
                selectedFeature.currentFeature = viewer.scene.pick(movement.position);
                //取场景坐标
                selectedFeature.currentFeaPosition = viewer.scene.pickPosition(movement.position);
                console.log(selectedFeature.currentFeaPosition);
                //还原上一个实体选中的样式
                if(Cesium.defined(selectedFeature.previousFeature))
                {
                    // city.style = defaultStyle;
                    selectedFeature.previousFeature.color = defaultColor;
                }
                //设置实体样式
                selectedFeature.currentFeature.color = Cesium.Color.ORANGERED;
                //属性框
                var name = selectedFeature.currentFeature.getProperty("name");

                showAtt({name: name}, movement.position);
                selectedFeature.previousFeature = selectedFeature.currentFeature;
            }

        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
        //鼠标左键弹起
        handler.setInputAction(function (movement)
        {
            console.log("LEFT_UP");

            isStartMove = false;
            // updatePropsDialog(movement.position)

        }, Cesium.ScreenSpaceEventType.LEFT_UP);
        //滚轮
        handler.setInputAction(function (movement)
        {
            console.log("WHEEL");
            //更新位置
            //取选中实体的场景坐标在当前屏幕的坐标位置
            var position = viewer.scene.cartesianToCanvasCoordinates(selectedFeature.currentFeaPosition);
            var cameraPos = viewer.camera.position;
            if(Cesium.defined(selectedFeature.currentFeature))
            {
                //var changePosition = {x: movement.endPosition.x - movement.startPosition.x, y: movement.endPosition.y - movement.startPosition.y};

                var distance = getDistance(cameraPos, selectedFeature.currentFeaPosition);
                //根据movement值得正负来判断拉近还是远离
                var isZoomIn = true;
                if(movement < 0)
                {
                    isZoomIn = false;
                }
                console.log(distance);
                updatePropsDialog(position , distance, isZoomIn);//distance
                updateInfo(overFeatures, distance);
            }
            else{
                distance = getDistance(cameraPos, initialPosition);
                updateInfo(overFeatures, distance);
            }

        }, Cesium.ScreenSpaceEventType.WHEEL);
        //鼠标滚轮按下
        handler.setInputAction(function (movement)
        {
            console.log("MIDDLE_DOWN");
            isStartRotate = true;

        }, Cesium.ScreenSpaceEventType.MIDDLE_DOWN);
        //鼠标滚轮弹起
        handler.setInputAction(function (movement)
        {
            console.log("MIDDLE_UP");
            isStartRotate = false;

        }, Cesium.ScreenSpaceEventType.MIDDLE_UP);

        //相机事件
        viewer.scene.camera.moveStart.addEventListener(function (evt) {
            console.log("moveStart");
        });
        viewer.scene.camera.moveEnd.addEventListener(function (evt) {
            console.log("moveEnd");
            // 取选中实体的场景坐标在当前屏幕的坐标位置

        });
        //实时渲染事件 解决移动、拖拽以后场景还会向前滑动一段距离
        viewer.scene.postRender.addEventListener(function () {
            //更新位置
            if(Cesium.defined(selectedFeature.currentFeature))
            {
                //取选中实体的场景坐标在当前屏幕的坐标位置
                var position = viewer.scene.cartesianToCanvasCoordinates(selectedFeature.currentFeaPosition);
                updatePropsDialog(position);

                var distance = getDistance(viewer.camera.position, selectedFeature.currentFeaPosition);
                updateInfo(overFeatures, distance);
            }
        });

    }

    function showAtt(att, position)
    {
        var dom = document.querySelector("#listmoduleright");
        var display = dom.style.display;
        if(display === "block")
        {

        }
        else{
            dom.style.display = "block";
            $("#listmoduleright").css("opacity", 1);
        }
        //重置0位置
        $("#listmoduleright").css("left", 0);
        $("#listmoduleright").css("top", 0);
        if(position)
        {
            updatePropsDialog(position)
        }
    }

    //更新属性框的位置
    function updatePropsDialog(position, distance, isZoomIn)
    {
        if ($("#listmoduleright").is(":hidden"))
        {
            return;
        }
        else
        {
            if(position)
            {
               /* var reg = /\d+/;
                var left = $("#listmoduleright").css("left");
                left = parseInt(reg.exec(left)[0]);
                left = left  + position.x;

                var top = $("#listmoduleright").css("top");
                top = parseInt(reg.exec(top)[0]);
                top = top + position.y;
                //边界值
                if(left < 0)
                    left = 0;
                if(left > window.innerWidth - 300)
                    left = window.innerWidth - 300;
                if(top < 0)
                    top = 0;
                var height = $("#listmoduleright").css("height");
                height = parseInt(reg.exec(height)[0]);
                if(top > window.innerHeight - height)
                {
                    top = window.innerHeight - height;
                }*/

                $("#listmoduleright").css("left", position.x);
                $("#listmoduleright").css("top", position.y);
            }
        }
        //设置多少米不可见
        if(distance)
        {
            if (distance > 3500 || distance < -150) {
                $("#listmoduleright").css("opacity", 0);
            }
     /*       if(distance > 500 && distance < 3500)
            {
                var opacity = $("#listmoduleright").css("opacity");
                if(opacity < 1 && isZoomIn)
                {
                        $("#listmoduleright").css("opacity", opacity + 50/distance);
                }
                if(!isZoomIn && opacity >= 0)
                {
                    $("#listmoduleright").css("opacity", opacity - distance/35000);
                }
            }*/

            if(500 <distance && distance< 1000)
            {
                $("#listmoduleright").css("opacity", 0.9);
            }
            else if(1000 <= distance && distance < 1500){
                $("#listmoduleright").css("opacity", 0.8);
            }
            else if(1500 <= distance && distance< 2000)
            {
                $("#listmoduleright").css("opacity", 0.7);
            }
            else if(2000 <= distance && distance < 2500)
            {
                $("#listmoduleright").css("opacity", 0.6);
            }
            else if(2500 <= distance && distance < 3000)
            {
                $("#listmoduleright").css("opacity", 0.5);
            }
            else if(3000 <= distance && distance < 3500)
            {
                $("#listmoduleright").css("opacity", 0.4);
            }


            if(distance > -150 && distance < 500)
            {
                $("#listmoduleright").css("opacity", 1);
            }
        }
    }

    function getInfo() {
        var img = document.createElement("img");
        $(img).addClass("info");
        img.src="./images/info.png";
        return img;
    }
    function updateInfo(overFeatures, distance)
    {
        var position = null;
        if(distance && distance > 2500)
        {
            $(".info").remove();
            overFeatures = [];
            return;
        }
        overFeatures.forEach(function (obj)
        {
            //在当前屏幕的坐标
            console.log(obj);
            position = viewer.scene.cartesianToCanvasCoordinates(obj.position);
            console.log(position);
            if(position)
            {
                $(obj.infoImg).css("left", position.x);
                $(obj.infoImg).css("top", position.y);
            }
            else{
                console.log("not found position");
                /*$(obj.infoImg).remove();
                obj.overstep = true;*/
            }
        });
    }

    function updateRotate(heading)
    {
        if ($("#listmoduleright").is(":hidden"))
            return;
        // var opacity = 1-  Math.abs(Math.sin(heading));
        var opacity = Math.abs(Math.cos(0.5*heading));
        console.log(opacity);
        $("#listmoduleright").css("opacity", opacity);
    }

    function getDistance(cameraPosition, pointPosition)
    {
        var distance1 = Math.sqrt(Math.pow(cameraPosition.x, 2), Math.pow(cameraPosition.y, 2), Math.pow(cameraPosition.z, 2));
        var distance2 = Math.sqrt(Math.pow(pointPosition.x, 2), Math.pow(pointPosition.y, 2), Math.pow(pointPosition.z, 2));

        return Math.abs(distance1 - distance2);
    }

    $("#listmoduleright  .close-btn").on("click", function (evt) {
        $("#listmoduleright").css("display", "none");
    });

     //////////////////////////////////////////////////////////////////////////
     // Custom mouse interaction for highlighting and selecting交互 鼠标选中展示实体info
     //////////////////////////////////////////////////////////////////////////

     // If the mouse is over a point of interest, change the entity billboard scale and color
   /*  var previousPickedEntity;
     var handler = viewer.screenSpaceEventHandler;
     handler.setInputAction(function (movement)
     {
         var pickedPrimitive = viewer.scene.pick(movement.endPosition);
         var pickedEntity = Cesium.defined(pickedPrimitive) ? pickedPrimitive.id : undefined;
         // Unhighlight the previously picked entity
         if (Cesium.defined(previousPickedEntity)) {
             previousPickedEntity.billboard.scale = 1.0;
             previousPickedEntity.billboard.color = Cesium.Color.WHITE;
         }
         // Highlight the currently picked entity
         if (Cesium.defined(pickedEntity) && Cesium.defined(pickedEntity.billboard)) {
             pickedEntity.billboard.scale = 2.0;
             pickedEntity.billboard.color = Cesium.Color.ORANGERED;
             previousPickedEntity = pickedEntity;
         }
     }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);*/

     //////////////////////////////////////////////////////////////////////////
     // Setup Camera Modes  相机模式
     //////////////////////////////////////////////////////////////////////////

    var freeModeElement = document.getElementById('freeMode');
     var droneModeElement = document.getElementById('droneMode');

     // Create a follow camera by tracking the drone entity
     function setViewMode() {
         if (droneModeElement.checked) {
             viewer.trackedEntity = drone;
         } else {
             viewer.trackedEntity = undefined;
             viewer.scene.camera.flyTo(homeCameraView);
         }
     }

     freeModeElement.addEventListener('change', setViewMode);
     droneModeElement.addEventListener('change', setViewMode);

     viewer.trackedEntityChanged.addEventListener(function() {
         if (viewer.trackedEntity === drone) {
             freeModeElement.checked = false;
             droneModeElement.checked = true;
         }
     });
     //////////////////////////////////////////////////////////////////////////
     // Setup Display Options  阴影效果展示
     //////////////////////////////////////////////////////////////////////////

     var shadowsElement = document.getElementById('shadows');
     var neighborhoodsElement =  document.getElementById('neighborhoods');

     shadowsElement.addEventListener('change', function (e) {
         viewer.shadows = e.target.checked;
     });

     neighborhoodsElement.addEventListener('change', function (e) {
         neighborhoods.show = e.target.checked;
     });

     // Finally, wait for the initial city to be ready before removing the loading indicator.
     var loadingIndicator = document.getElementById('loadingIndicator');
     loadingIndicator.style.display = 'block';
     city.readyPromise.then(function () {
         loadingIndicator.style.display = 'none';
     });

}());
