'use strict';

thumbnailApp.controller('pictureDirController', ['$scope', '$http', function($scope, $http) {
    console.log('Controller loading');

    $scope.loadPictureDir = (function getDir() {
        $http.get('/picturedir')
            .then(function successCallback(response) {
                console.log('Got picturedir response', response);
                if (response.data.path) {
                    $scope.pictureDir = response.data.path;
                    $scope.loadFileList(response.data.path);
                } else {
                    console.error('Unexpected API response without picture path');
                }

            }, function errorCallback(response) {
                console.error(response);
            });
    })();

    $scope.loadFileList = function getFiles(path) {
        $http.get('/filelist?directory=' + encodeURIComponent(path))
            .then(function successCallback(response){
                console.log('Got filelist response', response.data);
                $scope.fileList = response.data.path.reduce(function (first, second) {
                        return first += second.toString() + "\n";
                    }, "");
            }, function errorCallback(response) {
                console.error(response);
            });
    };

    $scope.submit = function submitButtonClicked() {
        $http.get('/process?directory=' + encodeURIComponent($scope.pictureDir))
            .then( function successCallback(response){
                console.log(response.data);
            }, function errorCallback(response) {
                console.error(response);
            });
    };

}]);

/*

 thumbnailControllers.controller('thumbnailController', [$scope, function($scope) {
 console.log('thumbnailController');

 $scope.items = [];
 $scope.thumbnails = thumbs;
 $scope.counter = 0;
 $scope.folders = [];
 $scope.keyList = [];

 console.log(thumbs.length + ' thumbs');

 for (thumb in $scope.thumbnails) {
 if ($scope.folders.indexOf($scope.thumbnails[thumb].folder) === -1) {
 $scope.folders.push($scope.thumbnails[thumb].folder);
 }
 }

 $scope.folders.sort();

 $scope.thumbnails.forEach( function(element, index) {
 for (key in element) {
 if (element.hasOwnProperty(key)) {
 if ($scope.keyList.indexOf(key) === -1) {
 $scope.keyList.push(key);
 var selectUIelement = document.getElementById('selectDiv');
 var selectElementToAdd = document.createElement('select');
 selectElementToAdd.setAttribute('id', key + 'Select');
 selectElementToAdd.setAttribute('class', 'selectElement');
 selectElementToAdd.setAttribute('when-scrolled', 'selectMore("' + key + 'Select")');
 selectElementToAdd.innerHTML = '<option value="">' + 'Select by ' + key + '</option>';
 var idHash = hashCode('option' + key + element[key]);
 selectElementToAdd.innerHTML = selectElementToAdd.innerHTML + '<option id="' + idHash + '" value="' + element[key] + '">' + element[key] + '</option>';
 selectUIelement.appendChild(selectElementToAdd);
 } else {
 if (document.getElementById(hashCode('option' + key + element[key])) === null) {
 var selectElement = document.getElementById(key + 'Select');
 if (selectElement.length < 100) {
 var idHash = hashCode('option' + key + element[key]);
 selectElement.innerHTML = selectElement.innerHTML + '<option id="' + idHash + '" value="' + element[key] + '">' + element[key] + '</option>';
 console.log('<option id="' + idHash + '" value="' + element[key] + '">' + element[key] + '</option>');
 }
 }
 }
 }
 }
 });

 console.log($scope.folders.length + ' folders');

 $scope.loadMore = function(filterKey, filterValue) {
 if (filterKey && filterValue) {
 console.log(filterKey + ' ' + filterValue);
 for (var i in $scope.thumbnails) {
 if ($scope.thumbnails[$scope.counter].hasOwnProperty(filterKey)) {
 if ($scope.thumbnails[$scope.counter][filterKey] === filterValue) {
 $scope.items.push($scope.thumbnails[$scope.counter]);
 }
 }

 $scope.counter += 1;
 }

 } else {
 for (var i = 0; i < 100; i++) {
 $scope.items.push($scope.thumbnails[$scope.counter]);
 $scope.counter += 1;
 }
 }
 };

 $scope.setFilter = function(filterKey) {
 $scope.selectedFolder = document.getElementById("fldrSelect").value;
 console.log(document.getElementById("fldrSelect").value);
 $scope.items = [];
 $scope.counter = 0;
 $scope.loadMore(filterKey, document.getElementById("fldrSelect").value);
 }
 }]);
 */
